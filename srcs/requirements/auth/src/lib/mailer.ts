import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT ?? 587),
	secure: Number(process.env.SMTP_PORT) === 465,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
});

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
	await transporter.sendMail({
		from: process.env.SMTP_FROM,
		to,
		subject: "Reset your Mycelium Notes password",
		text: `You requested a password reset.\n\nClick the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
		html: `
			<p>You requested a password reset.</p>
			<p>Click the link below to set a new password (valid for 1 hour):</p>
			<p><a href="${resetLink}">${resetLink}</a></p>
			<p>If you did not request this, you can ignore this email.</p>
		`,
	});
}
