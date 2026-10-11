import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";
import { getT } from "@/i18n/server";

// Dette er siden søkemotorene ser, siden alle andre sider sender dem hit.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { absolute: t.auth.login.metaTitle },
    alternates: { canonical: "/login" },
  };
}

export default async function LoginPage() {
  const t = await getT();
  return <div className="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-md content-center gap-5"><div><h1 className="text-2xl font-semibold">{t.auth.login.title}</h1><p className="text-muted">{t.auth.login.intro}</p></div><LoginForm /><Link href="/quiz" className="rounded-xl border border-border bg-surface p-4 text-sm transition hover:border-accent"><span className="font-semibold">🧠 {t.quiz.menu.title}</span><span className="mt-1 block text-muted">{t.quiz.menu.description}</span></Link></div>;
}
