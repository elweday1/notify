
import YAML from 'yaml'
import * as v from 'valibot'; // 1.24 kB

export const MessageSchema = v.object({
  type: v.literal("message"),
  email: v.pipe(v.string(), v.email()),
  subject: v.pipe(v.string(), v.maxLength(50)),
  message: v.pipe(v.string(), v.maxLength(255)),
  clientAddress: v.optional(v.string()),
});

export const NotificationSchema = v.object({
  type: v.literal("notification"),
  clientAddress: v.string(),
});

export const Schema = v.union([MessageSchema, NotificationSchema]);


export interface Env {
  MY_CHAT_ID: string;
  TELEGRAM_BOT_TOKEN: string;
}

export default {
	async fetch(request, {MY_CHAT_ID, TELEGRAM_BOT_TOKEN}): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
    }
    const requestData = await request.json();
    const {success, output: msg, issues} = v.safeParse(Schema, requestData)

    if (!success) {
      return new Response(JSON.stringify(issues.flat()), { status: 400 });
    }

    if (msg.type === "notification") {
      const response = await fetch(`http://ip-api.com/json/${msg.clientAddress}`);
      const data = (await response.json()) as IpData;
      return await sendTelegramMessage(YAML.stringify(data), TELEGRAM_BOT_TOKEN, MY_CHAT_ID);
    }

    if (msg.type === "message") {
      return await sendTelegramMessage(formatMessage(msg), TELEGRAM_BOT_TOKEN, MY_CHAT_ID);
    }

    return new Response(JSON.stringify({ error: "invalid request" }), { status: 400 });
},
} satisfies ExportedHandler<Env>;

async function sendTelegramMessage(message: string, TELEGRAM_BOT_TOKEN: string, MY_CHAT_ID: string) {
  const msg = encodeURIComponent(message);
  const endPoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${MY_CHAT_ID}&text=${msg}`;
  return await fetch(endPoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }); 
}

function formatMessage({email, message, subject, clientAddress}: v.InferInput<typeof MessageSchema>): string {
  return (
`
Subject: ${subject}
Email: ${email}
\n\n
${message}
`);
}
type IpData = {
  query: string;
  status: "success" | "fail";
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
};
