import type { ReactNode } from "react";
import { Component } from "react";
import { Alert, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";

type ReactErrorBoundaryProps = {
  children: ReactNode;
  onError?: (error: unknown, errorInfo: unknown) => void;
};

type ReactErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class ReactErrorBoundary extends Component<ReactErrorBoundaryProps, ReactErrorBoundaryState> {
  state: ReactErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown): ReactErrorBoundaryState {
    const message = error instanceof Error ? error.message : "Ukjent feil i React-applikasjonen.";
    return {
      hasError: true,
      message,
    };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error("React error boundary captured an error", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Paper withBorder radius="xl" shadow="md" p="xl">
        <Stack gap="md">
          <div>
            <Title order={3}>Noe gikk galt</Title>
            <Text c="dimmed">Siden traff en runtime-feil. Du kan laste siden på nytt.</Text>
          </div>

          <Alert color="red" variant="light" title="Feilmelding">
            {this.state.message}
          </Alert>

          <Group justify="flex-end">
            <Button variant="filled" color="brand" onClick={this.handleReload}>
              Last inn siden på nytt
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }
}
