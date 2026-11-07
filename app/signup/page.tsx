import Link from "next/link";
import { SignupForm } from "./signup-form";
import ui from "@/components/shared.module.css";
import styles from "@/app/login/login.module.css";

export const metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <main className={ui.standaloneState}>
      <section className={styles.loginFormWrap}>
        <span className={ui.eyebrow}>CAMPAIGN WORKSPACE</span>
        <h1>Create an account</h1>
        <p className={ui.muted}>
          Anyone can register. A campaign administrator must approve your
          account before you can access the app.
        </p>
        <SignupForm />
        <p className={styles.loginHelp}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
