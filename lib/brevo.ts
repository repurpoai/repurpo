
type BrevoRecipient = {
  email: string;
  name?: string | null;
};

type SendEmailInput = {
  to: BrevoRecipient;
  subject: string;
  html: string;
  text: string;
};

type SendEmailResult =
  | { ok: true }
  | { ok: false; reason: string };

async function readBrevoError(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as {
        message?: string;
        code?: string;
        errors?: Array<{ message?: string }>;
      };

      return (
        payload.message ||
        payload.errors?.[0]?.message ||
        `Brevo request failed with status ${response.status}.`
      );
    } catch {
      return `Brevo request failed with status ${response.status}.`;
    }
  }

  try {
    const text = (await response.text()).trim();
    return text || `Brevo request failed with status ${response.status}.`;
  } catch {
    return `Brevo request failed with status ${response.status}.`;
  }
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "Repurpo";

  if (!apiKey || !senderEmail) {
    return {
      ok: false,
      reason:
        "Brevo is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in your environment."
    };
  }

  if (!input.to.email) {
    return {
      ok: false,
      reason: "Recipient email is missing."
    };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: {
          email: senderEmail,
          name: senderName
        },
        to: [input.to],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      return { ok: false, reason: await readBrevoError(response) };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "Brevo request failed. Check your API key, sender verification, and network access."
    };
  }
}
