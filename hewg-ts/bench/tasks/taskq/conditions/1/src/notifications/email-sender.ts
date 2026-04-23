
import * as net from "node:net";
import type { EmailContent } from "./template-renderer";

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
}

function buildSmtpPayload(content: EmailContent, to: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${content.subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    "",
    content.textBody,
  ];
  return lines.join("\r\n");
}

export async function sendEmail(
  config: SmtpConfig,
  content: EmailContent,
  to: string,
): Promise<boolean> {
  const payload = buildSmtpPayload(content, to);

  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection(
      { host: config.host, port: config.port },
      () => {
        socket.write(`AUTH ${config.username} ${config.password}\r\n`);
        socket.write(payload);
        socket.write("\r\n.\r\n");
        socket.end();
      },
    );

    socket.on("data", (data) => {
      const response = data.toString();
      if (response.startsWith("250")) {
        resolve(true);
      }
    });

    socket.on("end", () => {
      resolve(true);
    });

    socket.on("error", () => {
      resolve(false);
    });

    socket.setTimeout(10_000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}
