"use client";

import Link from "next/link";
import classNames from "@shared/lib/classNames";
import styles from "./Button.module.css";

const cx = classNames.bind(styles);

interface IButtonProps {
  variant?: "default" | "primary";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function Button(props: IButtonProps) {
  const {
    variant = "default",
    size = "md",
    block,
    disabled,
    href,
    onClick,
    title,
    children,
    className,
    style,
  } = props;

  const spacing: React.CSSProperties = {};
  if (block) { spacing.width = "100%"; spacing.display = "flex"; }

  const el = (
    <span
      className={cx("Btn", variant === "primary" && "Primary", size === "sm" && "Sm", size === "lg" && "Lg", className)}
      style={{ ...spacing, ...style }}
    >
      {children}
    </span>
  );

  if (href) {
    return (
      <Link href={href} title={title} style={{ textDecoration: "none" }}>
        {el}
      </Link>
    );
  }

  return (
    <button
      className={cx("Btn", variant === "primary" && "Primary", size === "sm" && "Sm", size === "lg" && "Lg", className)}
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={{ ...spacing, ...style }}
    >
      {children}
    </button>
  );
}
