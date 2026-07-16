import { Badge } from "@/components/ui/badge";
import type { LabFundStatus } from "@/lib/types";

/** 진행=초록, 상환=보라+골드, 미확인=회색 */
export function FundStatusBadge({ status }: { status: LabFundStatus }) {
  if (status === "active") return <Badge variant="active">진행중</Badge>;
  if (status === "repaid") return <Badge variant="repaid">상환완료</Badge>;
  return <Badge variant="unknown">미확인</Badge>;
}
