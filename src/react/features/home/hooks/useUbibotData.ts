import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchUbibotChannels, fetchUbibotHourlyByChannel, type UbibotHourlyRow } from "../../../../repo/ubibotRepo";
import {
  asBucket,
  asMonthValue,
  asSpan,
  bucketsForSpan,
  currentMonthValue,
  defaultBucketForSpan,
  fetchWindow,
} from "../lib/ubibotChart";
import type { UbiBucket, UbiSpan } from "../types";

export type UseUbibotDataResult = {
  span: UbiSpan;
  monthValue: string;
  bucket: UbiBucket;
  rows: UbibotHourlyRow[];
  loading: boolean;
  loadingRows: boolean;
  loadError: string | null;
  emptyMessage: string | null;
  showMonth: boolean;
  bucketOptions: ReturnType<typeof bucketsForSpan>;
  setSpanValue: (value: string) => void;
  setMonthValue: (value: string) => void;
  setBucketValue: (value: string) => void;
  refresh: () => void;
};

export function useUbibotData(): UseUbibotDataResult {
  const [span, setSpan] = useState<UbiSpan>("30d");
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [bucket, setBucket] = useState<UbiBucket>("day");
  const [channelId, setChannelId] = useState("");
  const [rows, setRows] = useState<UbibotHourlyRow[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const channelReqRef = useRef(0);
  const rowsReqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++channelReqRef.current;

    setLoadingChannels(true);
    setLoadError(null);
    setEmptyMessage(null);

    void (async () => {
      try {
        const channels = await fetchUbibotChannels();
        if (cancelled || requestId !== channelReqRef.current) return;
        if (channels.length === 0) {
          setChannelId("");
          setRows([]);
          setLoadError(null);
          setEmptyMessage("Ingen UbiBot-data tilgjengelig.");
          return;
        }
        setChannelId(channels[0].channel_id);
        setEmptyMessage(null);
      } catch (err) {
        console.error("Failed to load UbiBot channels", err);
        if (cancelled || requestId !== channelReqRef.current) return;
        setChannelId("");
        setRows([]);
        setLoadError("Klarte ikke laste UbiBot-kanaler.");
        setEmptyMessage(null);
      } finally {
        if (cancelled || requestId !== channelReqRef.current) return;
        setLoadingChannels(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const monthFetchValue = span === "month" ? monthValue : "";
  useEffect(() => {
    if (!channelId) return;

    let cancelled = false;
    const requestId = ++rowsReqRef.current;
    const window = fetchWindow(span, monthValue);

    setLoadingRows(true);
    setLoadError(null);
    setEmptyMessage(null);

    void (async () => {
      try {
        const nextRows = await fetchUbibotHourlyByChannel(channelId, {
          sinceIso: window.sinceIso,
          untilIsoExclusive: window.untilIsoExclusive,
          limit: window.limit,
        });
        if (cancelled || requestId !== rowsReqRef.current) return;
        setRows(nextRows);
      } catch (err) {
        console.error("Failed to load UbiBot rows", err);
        if (cancelled || requestId !== rowsReqRef.current) return;
        setRows([]);
        setLoadError("Klarte ikke hente klimadata.");
        setEmptyMessage(null);
      } finally {
        if (cancelled || requestId !== rowsReqRef.current) return;
        setLoadingRows(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [channelId, span, monthFetchValue, refreshTick]);

  const setSpanValue = useCallback((value: string) => {
    const nextSpan = asSpan(value);
    setSpan(nextSpan);
    setBucket(defaultBucketForSpan(nextSpan));
    if (nextSpan === "month") {
      setMonthValue((prev) => asMonthValue(prev));
    }
  }, []);

  const setMonthFieldValue = useCallback((value: string) => {
    setMonthValue(asMonthValue(value));
  }, []);

  const setBucketValue = useCallback((value: string) => {
    setBucket(asBucket(value));
  }, []);

  const refresh = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  const bucketOptions = useMemo(() => bucketsForSpan(span), [span]);
  const loading = loadingChannels || loadingRows;

  return {
    span,
    monthValue,
    bucket,
    rows,
    loading,
    loadingRows,
    loadError,
    emptyMessage,
    showMonth: span === "month",
    bucketOptions,
    setSpanValue,
    setMonthValue: setMonthFieldValue,
    setBucketValue,
    refresh,
  };
}
