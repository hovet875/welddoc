import { supabase } from "../services/supabaseClient";

export type UbibotHourlyRow = {
  channel_id: string;
  bucket_start: string;
  temp_avg: number | null;
  rh_avg: number | null;
  temp_min: number | null;
  temp_max: number | null;
  rh_min: number | null;
  rh_max: number | null;
  samples: number | null;
  inserted_at: string;
};

export type UbibotChannelRow = {
  channel_id: string;
  last_bucket_start: string | null;
};

type ChannelScanRow = {
  channel_id: string | null;
  bucket_start: string | null;
};

export async function fetchUbibotChannels(opts?: { scanLimit?: number }) {
  const scanLimit = Math.min(Math.max(opts?.scanLimit ?? 5000, 200), 20000);
  const { data, error } = await supabase
    .from("ubibot_hourly")
    .select("channel_id, bucket_start")
    .order("bucket_start", { ascending: false })
    .limit(scanLimit);
  if (error) throw error;

  const rows = (data ?? []) as ChannelScanRow[];
  const byChannel = new Map<string, string | null>();
  for (const row of rows) {
    const channelId = String(row.channel_id ?? "").trim();
    if (!channelId || byChannel.has(channelId)) continue;
    byChannel.set(channelId, row.bucket_start ?? null);
  }

  return Array.from(byChannel.entries()).map(
    ([channel_id, last_bucket_start]) =>
      ({
        channel_id,
        last_bucket_start,
      }) satisfies UbibotChannelRow
  );
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
      temp_min,
      temp_max,
      rh_min,
      rh_max,
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
