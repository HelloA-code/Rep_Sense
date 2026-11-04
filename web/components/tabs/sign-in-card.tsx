import Link from "next/link";
import { Card } from "@/components/ui/card";
import { secondaryButtonClass } from "@/components/ui/styles";

/** Shown on tabs that need saved data when nobody is signed in. */
export function SignInCard({ text, next }: { text: string; next: string }) {
  return (
    <Card className="flex flex-col items-center px-6 py-8 text-center">
      <h2 className="text-[17px] font-bold">Sign in to see your progress</h2>
      <p className="mt-1.5 max-w-[30ch] text-[14px] font-medium text-muted">{text}</p>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={`${secondaryButtonClass} mt-5`}>
        Sign in
      </Link>
    </Card>
  );
}
