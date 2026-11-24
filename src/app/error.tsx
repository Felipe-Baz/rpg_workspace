"use client";

import ErroRota from "@/components/ui/ErroRota";

export default function Error(props: { error: unknown; retry: () => void }) {
  return <ErroRota {...props} />;
}
