import { Group, Pagination, Text } from "@mantine/core";
import { AppSelect } from "./AppSelect";

type AppPaginationToolbarProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
  pageSizeOptions?: number[];
  pageSizeLabel?: string;
  disabled?: boolean;
  hideWhenSinglePage?: boolean;
};

function toOptions(options: number[]) {
  return options.map((value) => ({
    value: String(value),
    label: `${value} / side`,
  }));
}

export function AppPaginationToolbar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  pageSizeLabel = "Rader",
  disabled = false,
  hideWhenSinglePage = false,
}: AppPaginationToolbarProps) {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (hideWhenSinglePage && totalPages <= 1) return null;
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  return (
    <Group justify="space-between" align="center" wrap="wrap">
      <Text size="sm" c="dimmed">
        Viser {from}-{to} av {total}
      </Text>

      <Group gap="md" align="center" wrap="wrap">
        <Group gap="xs" align="center" wrap="nowrap">
          <Text size="sm" c="dimmed">
            {pageSizeLabel}
          </Text>
          <AppSelect
            value={String(pageSize)}
            onChange={(value) => {
              const next = Number(value || pageSize);
              if (!Number.isFinite(next) || !pageSizeOptions.includes(next)) return;
              onPageSizeChange(next);
            }}
            data={toOptions(pageSizeOptions)}
            allowDeselect={false}
            searchable={false}
            w={120}
            disabled={disabled}
          />
        </Group>

        <Pagination
          value={page}
          onChange={onPageChange}
          total={totalPages}
          siblings={1}
          boundaries={1}
          size="sm"
          withEdges={totalPages > 5}
          disabled={disabled}
        />
      </Group>
    </Group>
  );
}
