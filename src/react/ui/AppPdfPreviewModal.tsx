import { Alert, Box, Group, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { AppButton } from "@react/ui/AppButton";
import { AppModal } from "@react/ui/AppModal";

export type AppPdfPreviewState = {
  opened: boolean;
  title: string;
  url: string | null;
  loading: boolean;
  error: string | null;
};

type AppPdfPreviewModalProps = {
  preview: AppPdfPreviewState;
  onClose: () => void;
};

export function AppPdfPreviewModal({ preview, onClose }: AppPdfPreviewModalProps) {
  const isMobile = useMediaQuery("(max-width: 48em)");
  const desktopHeight = "84vh";

  return (
    <AppModal
      opened={preview.opened}
      onClose={onClose}
      title={preview.title}
      size={isMobile ? "100%" : "min(1180px, 94vw)"}
      fullScreen={isMobile}
      styles={{
        content: {
          display: "flex",
          flexDirection: "column",
          height: isMobile ? "100dvh" : desktopHeight,
          maxHeight: isMobile ? "100dvh" : desktopHeight,
        },
        body: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        },
      }}
    >
      <Box
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          gap: "12px",
        }}
      >
        {preview.loading ? <Text c="dimmed">Laster PDF...</Text> : null}
        {preview.error ? (
          <Alert color="red" variant="light" title="Feil">
            {preview.error}
          </Alert>
        ) : null}
        {preview.url ? (
          <Box style={{ flex: 1, minHeight: 0, borderRadius: "10px", overflow: "hidden" }}>
            <Box
              component="iframe"
              src={preview.url}
              title={preview.title}
              style={{
                width: "100%",
                height: "100%",
                border: 0,
                background: "#0b0e12",
                display: "block",
              }}
            />
          </Box>
        ) : null}

        <Group justify="flex-end" mt="auto">
          <AppButton tone="neutral" onClick={onClose}>
            Lukk
          </AppButton>
          {preview.url ? (
            <AppButton
              tone="primary"
              onClick={() => {
                window.open(preview.url ?? "", "_blank", "noopener,noreferrer");
              }}
            >
              Åpne i ny fane
            </AppButton>
          ) : null}
        </Group>
      </Box>
    </AppModal>
  );
}
