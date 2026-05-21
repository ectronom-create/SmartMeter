import { useEffect, useState } from "react";

export default function CountdownTimer({ resolvedAt, isRtl }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTime = () => {
      const diff = 5 * 60 * 1000 - (Date.now() - new Date(resolvedAt).getTime());
      if (diff <= 0) {
        return "0:00";
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    setTimeLeft(calculateTime());

    const interval = setInterval(() => {
      setTimeLeft(calculateTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [resolvedAt]);

  if (timeLeft === "0:00") {
    return (
      <span style={{ fontSize: "0.75rem", color: "var(--red)", fontWeight: 700, marginLeft: isRtl ? 0 : 6, marginRight: isRtl ? 6 : 0 }}>
        {isRtl ? "(جاري الحذف...)" : "(deleting...)"}
      </span>
    );
  }

  return (
    <span style={{ fontSize: "0.75rem", color: "var(--red)", fontWeight: 600, marginLeft: isRtl ? 0 : 6, marginRight: isRtl ? 6 : 0, whiteSpace: "nowrap" }}>
      {isRtl ? `(حذف خلال ${timeLeft})` : `(deletes in ${timeLeft})`}
    </span>
  );
}
