import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  LINE_CHANNEL_ID: z.string().default(""),
  LINE_CHANNEL_SECRET: z.string().default(""),
  LIFF_ID: z.string().default(""),
  LINE_MESSAGING_TOKEN: z.string().default(""),
  FILE_STORAGE_PATH: z.string().default(""),
  APP_ORIGIN: z.string().default("http://localhost:3000"),
  BOOTSTRAP_ADMIN_EMPLOYEE_CODE: z.string().default(""),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`Invalid environment configuration. ${details}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/// LINE features stay off until the channel credentials exist.
export function lineLoginConfigured(): boolean {
  const e = env();
  return e.LINE_CHANNEL_ID.length > 0 && e.LINE_CHANNEL_SECRET.length > 0;
}

export function liffConfigured(): boolean {
  return env().LIFF_ID.length > 0;
}

export function linePushConfigured(): boolean {
  return env().LINE_MESSAGING_TOKEN.length > 0;
}
