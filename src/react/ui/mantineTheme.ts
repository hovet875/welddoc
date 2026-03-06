import {
  Accordion,
  ActionIcon,
  Autocomplete,
  Badge,
  Button,
  Checkbox,
  Drawer,
  FileInput,
  Modal,
  Menu,
  MultiSelect,
  NativeSelect,
  NumberInput,
  Pagination,
  PasswordInput,
  Paper,
  Select,
  Table,
  Tabs,
  TagsInput,
  Textarea,
  TextInput,
  createTheme,
  DEFAULT_THEME,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { Dropzone } from "@mantine/dropzone";

const FIELD_INPUT_STYLES = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  transition: "border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
} as const;

const FIELD_DROPDOWN_STYLES = {
  background: "linear-gradient(180deg, rgba(22, 30, 44, 0.98), rgba(16, 24, 36, 0.98))",
  border: "1px solid var(--border)",
  boxShadow: "var(--mantine-shadow-md)",
  borderRadius: "14px",
  zIndex: 460,
} as const;

const FIELD_OPTION_STYLES = {
  color: "var(--mantine-color-text)",
  minHeight: "34px",
  borderRadius: "8px",
} as const;

const MODAL_OVERLAY_PROPS = {
  backgroundOpacity: 0.62,
  blur: 2,
} as const;

const DRAWER_OVERLAY_PROPS = {
  backgroundOpacity: 0.62,
  blur: 0,
} as const;

const SURFACE_CONTENT_STYLES = {
  background: "linear-gradient(180deg, rgba(20, 28, 42, 0.98), rgba(12, 20, 33, 0.99))",
  border: "1px solid var(--border)",
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.45)",
} as const;

const SURFACE_HEADER_STYLES = {
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03))",
  borderBottom: "1px solid var(--border)",
  padding: "16px 18px",
} as const;

const SURFACE_TITLE_STYLES = {
  fontSize: "18px",
  fontWeight: 700,
  color: "var(--text)",
  letterSpacing: "-0.2px",
} as const;

const SURFACE_BODY_STYLES = {
  padding: "16px 18px 18px",
  background: "transparent",
} as const;

export const mantineTheme = createTheme({
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: "md",
  white: "#e8eef7",
  black: "#0b1220",
  colors: {
    ...DEFAULT_THEME.colors,
    brand: [
      "#eaf7ff",
      "#ccecff",
      "#abdfff",
      "#86cfff",
      "#63beff",
      "#45a8ef",
      "#3586be",
      "#25658e",
      "#17455f",
      "#0c2838",
    ],
    dark: [
      "#c1c2c5",
      "#a6a7ab",
      "#909296",
      "#5c5f66",
      "#373a40",
      "#2c2e33",
      "#25262b",
      "#1a1b1e",
      "#141517",
      "#101113",
    ],
  },

  variantColorResolver: (input) => {
    const resolved = DEFAULT_THEME.variantColorResolver(input);

    // Skru opp "light" så den ikke blir grå på dark/glass
    if (input.variant === "light") {
      return {
        ...resolved,
        background: `color-mix(in srgb, var(--mantine-color-${input.color}-6) 16%, transparent)`,
        color: "var(--mantine-color-white)",
      };
    }

    // Skru opp outline så den ikke blir svart/grå
    if (input.variant === "outline") {
      return {
        ...resolved,
        border: `1px solid color-mix(in srgb, var(--mantine-color-${input.color}-6) 60%, transparent)`,
        color: "var(--mantine-color-white)",
      };
    }

    return resolved;
  },
  
  radius: {
    xs: "8px",
    sm: "10px",
    md: "12px",
    lg: "16px",
    xl: "18px",
  },
  shadows: {
    sm: "0 6px 16px rgba(0,0,0,0.2)",
    md: "0 10px 26px rgba(0,0,0,0.18)",
    lg: "0 18px 60px rgba(0,0,0,0.35)",
  },
  components: {
    Paper: Paper.extend({
      styles: {
        root: {
          background: "var(--panel-gradient-soft)",
          borderColor: "var(--border)",
        },
      },
    }),
    Button: Button.extend({
      defaultProps: {
        size: "sm",
        radius: "md",
      },
      styles: (_, props) => {
        const isPrimaryFilled = props.variant === "filled" && (props.color === "brand" || props.color == null);

        return {
          root: {
            fontWeight: 600,
            ...(isPrimaryFilled
              ? {
                  background: "var(--mantine-color-brand-6)",
                  border: "1px solid var(--mantine-color-brand-5)",
                  color: "var(--mantine-color-white)",
                }
              : null),
          },
        };
      },
    }),
    Checkbox: Checkbox.extend({
  defaultProps: {
    size: "sm",
    radius: "xs",
    color: "brand",
  },
  styles: (_theme, props) => {
    const c = (props.color ?? "brand") as string;

    return {
      root: {
        // gjør at label/checkbox aligner pent i tabeller og rader
        alignItems: "center",
      },

      input: {
        // base glass look
        background: "var(--panel)",
        border: "1px solid var(--border)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        transition: "background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease",

        // litt mer “square” følelse
        borderRadius: "8px",
        outline: "none",
        backgroundColor: `color-mix(in srgb, var(--mantine-color-${c}-6) 8%, var(--panel))`,
        borderColor: `color-mix(in srgb, var(--mantine-color-${c}-5) 24%, var(--border))`,
      },

      icon: {
        // checkmark farge
        color: "var(--text)",
        // litt “crisper” på mørk bakgrunn
        filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.35))",
      },

      label: {
        color: "var(--text)",
        userSelect: "none",
      },

      description: {
        color: "var(--muted)",
      },
    };
  },
}),
    ActionIcon: ActionIcon.extend({
      defaultProps: {
        radius: "sm",
      },
      styles: {
        root: {
          border: "1px solid var(--border)",
        },
      },
    }),
    Badge: Badge.extend({
      defaultProps: {
      radius: "xl",
      variant: "light",
    },
    styles: (_theme, props) => {
    const c = (props.color ?? "gray") as string;

    // Tweak disse 3 hvis du vil
    const bgMix = 16;   // 12–18
    const bdMix = 40;   // 34–50
    const textShade = 2; // 1–3 (lavere = lysere)

    return {
      root: {
        fontWeight: 750,
        letterSpacing: "0.25px",

        background: `color-mix(in srgb, var(--mantine-color-${c}-6) ${bgMix}%, transparent)`,
        border: `1px solid color-mix(in srgb, var(--mantine-color-${c}-6) ${bdMix}%, transparent)`,
        color: `var(--mantine-color-${c}-${textShade})`,

        // litt “glass”/dybde uten å bli glossy
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
    };
  },
}),
    TextInput: TextInput.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
      },
      styles: {
        input: FIELD_INPUT_STYLES,
      },
    }),
    Textarea: Textarea.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
        autosize: true,
      },
      styles: {
        input: {
          ...FIELD_INPUT_STYLES,
          minHeight: "108px",
          lineHeight: 1.5,
        },
      },
    }),
    PasswordInput: PasswordInput.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
      },
      styles: {
        input: FIELD_INPUT_STYLES,
        innerInput: {
          color: "var(--text)",
        },
        section: {
          color: "var(--muted)",
        },
      },
    }),
    NativeSelect: NativeSelect.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
      },
      styles: {
        input: FIELD_INPUT_STYLES,
      },
    }),
    NumberInput: NumberInput.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
      },
      styles: {
        input: FIELD_INPUT_STYLES,
        section: {
          color: "var(--muted)",
        },
      },
    }),
    Select: Select.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
        comboboxProps: {
          withinPortal: true,
          portalProps: {
            target: ".react-root",
          },
          zIndex: 460,
        },
        maxDropdownHeight: 260,
      },
      styles: {
        input: FIELD_INPUT_STYLES,
        dropdown: FIELD_DROPDOWN_STYLES,
        option: FIELD_OPTION_STYLES,
      },
    }),
    Autocomplete: Autocomplete.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
        comboboxProps: {
          withinPortal: true,
          portalProps: {
            target: ".react-root",
          },
          zIndex: 460,
        },
        maxDropdownHeight: 260,
      },
      styles: {
        input: FIELD_INPUT_STYLES,
        dropdown: FIELD_DROPDOWN_STYLES,
        option: FIELD_OPTION_STYLES,
      },
    }),
    TagsInput: TagsInput.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
        comboboxProps: {
          withinPortal: true,
          portalProps: {
            target: ".react-root",
          },
          zIndex: 460,
        },
        maxDropdownHeight: 260,
      },
      styles: {
        input: {
          ...FIELD_INPUT_STYLES,
          minHeight: "90px",
          alignItems: "flex-start",
          paddingTop: "8px",
          paddingBottom: "8px",
        },
        dropdown: FIELD_DROPDOWN_STYLES,
        option: FIELD_OPTION_STYLES,
        pill: {
          background: "color-mix(in srgb, var(--mantine-color-brand-6) 24%, transparent)",
          border: "1px solid color-mix(in srgb, var(--mantine-color-brand-5) 34%, transparent)",
          color: "var(--text)",
        },
      },
    }),
    MultiSelect: MultiSelect.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
        comboboxProps: {
          withinPortal: true,
          portalProps: {
            target: ".react-root",
          },
          zIndex: 460,
        },
        maxDropdownHeight: 260,
      },
      styles: {
        input: FIELD_INPUT_STYLES,
        dropdown: FIELD_DROPDOWN_STYLES,
        option: FIELD_OPTION_STYLES,
        pill: {
          background: "color-mix(in srgb, var(--mantine-color-brand-6) 25%, transparent)",
          border: "1px solid color-mix(in srgb, var(--mantine-color-brand-5) 35%, transparent)",
        },
      },
    }),
    DateInput: DateInput.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
      },
      styles: {
        input: FIELD_INPUT_STYLES,
        section: {
          color: "var(--muted)",
        },
      },
    }),
    FileInput: FileInput.extend({
      defaultProps: {
        size: "sm",
        variant: "filled",
      },
      styles: {
        input: FIELD_INPUT_STYLES,
        section: {
          color: "var(--muted)",
        },
      },
    }),
    Dropzone: Dropzone.extend({
      defaultProps: {
        radius: "md",
      },
      styles: {
        root: {
          background: "color-mix(in srgb, var(--mantine-color-brand-7) 15%, transparent)",
          border: "1px dashed color-mix(in srgb, var(--mantine-color-brand-4) 55%, transparent)",
        },
      },
    }),
    Table: Table.extend({
      defaultProps: {
        withTableBorder: false,
        withColumnBorders: false,
        withRowBorders: false,
        highlightOnHover: true,
        verticalSpacing: "sm",
      },
      styles: {
        table: {
          "--table-highlight-on-hover-color":
            "color-mix(in srgb, var(--mantine-color-brand-7) 34%, transparent)",
        },
        th: {
          background: "color-mix(in srgb, var(--mantine-color-brand-8) 26%, transparent)",
          borderBottom: "1px solid var(--border)",
          fontWeight: 700,
        },
        td: {
          borderBottom: "none",
        },
      },
    }),
    Modal: Modal.extend({
      defaultProps: {
        radius: "xl",
        shadow: "lg",
        portalProps: {
          target: ".react-root",
        },
        overlayProps: MODAL_OVERLAY_PROPS,
      },
      styles: {
        content: {
          ...SURFACE_CONTENT_STYLES,
          borderRadius: "20px",
        },
        header: {
          ...SURFACE_HEADER_STYLES,
          borderRadius: "20px 20px 0 0",
        },
        title: SURFACE_TITLE_STYLES,
        body: SURFACE_BODY_STYLES,
        close: {
          color: "var(--muted)",
        },
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: {
        shadow: "lg",
        portalProps: {
          target: ".react-root",
        },
        overlayProps: DRAWER_OVERLAY_PROPS,
      },
      styles: {
        content: SURFACE_CONTENT_STYLES,
        header: SURFACE_HEADER_STYLES,
        title: SURFACE_TITLE_STYLES,
        body: SURFACE_BODY_STYLES,
        close: {
          color: "var(--muted)",
        },
      },
    }),
    Accordion: Accordion.extend({
      styles: {
        item: {
          border: "none",
        },
        control: {
          background: "transparent",
          transition: "background-color 120ms ease",
        },
      },
    }),
    Menu: Menu.extend({
      styles: {
        dropdown: {
          background: "var(--mantine-color-body)",
          border: "1px solid var(--mantine-color-dark-4)",
          boxShadow: "var(--mantine-shadow-md)",
        },
        item: {
          color: "var(--mantine-color-text)",
        },
      },
    }),
    Tabs: Tabs.extend({
      defaultProps: {
        radius: "xl",
        classNames: {
          list: "app-tabs-list",
          tab: "app-tabs-tab",
        },
      },
    }),
    Pagination: Pagination.extend({
      defaultProps: {
        radius: "xl",
        size: "sm",
      },
      vars: () => ({
        root: {
          "--pagination-active-bg": "var(--mantine-color-brand-3)",
          "--pagination-active-color": "var(--mantine-color-dark-9)",
        },
      }),
      styles: {
        control: {
          transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
        },
      },
    }),
  },
});
