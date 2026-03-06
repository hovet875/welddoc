import { supabase } from "../services/supabaseClient";

export type UbibotHourlyRow = {
  channel_id: string;
  bucket_start: string;
  temp_avg: number | null;
  rh_avg: number | null;
  samples: number | null;
  inserted_at: string;
};

export type UbibotChannelRow = {
  channel_id: string;
  last_bucket_start: string | null;
};

const UBIBOT_CHANNEL_CACHE_MS = 5 * 60 * 1000;

type ChannelRpcRow = {
  channel_id: string | null;
  last_bucket_start: string | null;
};

let cachedUbibotChannels:
  | {
      value: UbibotChannelRow[];
      expiresAt: number;
    }
  | null = null;
let ubibotChannelsPromise: Promise<UbibotChannelRow[]> | null = null;

function normalizeUbibotChannels(rows: Array<{ channel_id: string | null; last_bucket_start: string | null }>) {
  return rows
    .map((row) => ({
      channel_id: String(row.channel_id ?? "").trim(),
      last_bucket_start: row.last_bucket_start ?? null,
    }))
    .filter((row) => row.channel_id)
    .map((row) => row satisfies UbibotChannelRow);
}

async function fetchUbibotChannelsViaRpc() {
  const { data, error } = await supabase.rpc("list_ubibot_channels");
  if (error) throw error;
  return normalizeUbibotChannels((data ?? []) as ChannelRpcRow[]);
}

export async function fetchUbibotChannels() {
  if (cachedUbibotChannels && cachedUbibotChannels.expiresAt > Date.now()) {
    return cachedUbibotChannels.value;
  }

  if (ubibotChannelsPromise) {
    return ubibotChannelsPromise;
  }

  const request = (async () => {
    const channels = await fetchUbibotChannelsViaRpc();
    cachedUbibotChannels = {
      value: channels,
      expiresAt: Date.now() + UBIBOT_CHANNEL_CACHE_MS,
    };

    return channels;
  })();

  ubibotChannelsPromise = request;

  try {
    return await request;
  } finally {
    ubibotChannelsPromise = null;
  }
}

export async function fetchUbibotHourlyByChannel(
  channelId: string,
  opts?: { sinceIso?: string; untilIsoExclusive?: string; limit?: number }
) {
  const id = channelId.trim();
  if (!id) return [] as UbibotHourlyRow[];

  let q = supabase
    .from("ubibot_hourly")
    .select(
      `
      channel_id,
      bucket_start,
      temp_avg,
      rh_avg,
      samples,
      inserted_at
    `
    )
    .eq("channel_id", id)
    .order("bucket_start", { ascending: true });

  if (opts?.sinceIso) {
    q = q.gte("bucket_start", opts.sinceIso);
  }
  if (opts?.untilIsoExclusive) {
    q = q.lt("bucket_start", opts.untilIsoExclusive);
  }

  const maxRows = Math.min(Math.max(opts?.limit ?? 5000, 100), 20000);
  const { data, error } = await q.limit(maxRows);
  if (error) throw error;
  return (data ?? []) as UbibotHourlyRow[];
}
