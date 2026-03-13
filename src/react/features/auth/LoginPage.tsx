import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Alert, Box, Center, Image, Paper, Stack } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { signIn } from "@/auth/authClient";
import { AppButton } from "@react/ui/AppButton";
import { AppCheckbox } from "@react/ui/AppCheckbox";
import { AppTextInput } from "@react/ui/AppTextInput";
import { useAuth } from "../../auth/AuthProvider";
import { IconAlertCircle } from "@tabler/icons-react";
import { ROUTES } from "@react/router/routes";

function readRememberMe() {
  try {
    const saved = localStorage.getItem("rememberMe");
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

function formatLoginError(err: unknown) {
  if (err instanceof Error && err.message) {
    switch (err.message) {
      case "Invalid login credentials":
        return "Feil e-post eller passord.";
      case "Email not confirmed":
        return "Du må bekrefte e-posten din før du kan logge inn.";
      default:
        return "Innlogging feilet. Prøv igjen.";
    }
  }

  return "Innlogging feilet.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const { message, clearMessage, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(readRememberMe);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!message) return;
    setError(message);
  }, [message]);

  const resetErrors = () => {
    if (error) setError("");
    if (message) clearMessage();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    resetErrors();
    setIsSubmitting(true);
    try {
      localStorage.setItem("rememberMe", String(remember));
      await signIn(email.trim(), password);
      await refresh();
      navigate(ROUTES.home, { replace: true });
    } catch (err) {
      console.error(err);
      setError(formatLoginError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
    }}>
        <Paper withBorder radius="xl" shadow="xl" p="xl" w="100%" maw={420}>
          <Stack gap="lg">
            <Center>
              <Image src="/images/titech-logo-login.png" alt="WeldDoc" fit="contain" style={{height: "clamp(90px, 12vw, 140px)", width: "auto", maxWidth: "80%",}} />
            </Center>

            <form onSubmit={onSubmit}>
              <Stack gap="md">
                <AppTextInput
                  label="E-post"
                  id="react-email"
                  value={email}
                  onChange={(value) => {
                    resetErrors();
                    setEmail(value);
                  }}
                  disabled={isSubmitting}
                  type="email"
                  autoComplete="username"
                />

                <AppTextInput
                  label="Passord"
                  id="react-pass"
                  value={password}
                  onChange={(value) => {
                    resetErrors();
                    setPassword(value);
                  }}
                  disabled={isSubmitting}
                  type="password"
                  autoComplete="current-password"
                />

                <AppCheckbox checked={remember} onChange={setRemember} disabled={isSubmitting} label="Husk meg" />

                <AppButton tone="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Logger inn..." : "Logg inn"}
                </AppButton>
              </Stack>
            </form>

            {error ? (
              <Alert icon={<IconAlertCircle size={18} />} variant="light" color="red">{error}</Alert>
            ) : null}
          </Stack>
        </Paper>
    </Box>
  );
}
