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

export async function sendTransactionalEmail(input: SendEmailInput) {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "Repurpo";

  if (!apiKey || !senderEmail || !input.to.email) {
    return false;
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

    return response.ok;
  } catch {
    return false;
  }
}
