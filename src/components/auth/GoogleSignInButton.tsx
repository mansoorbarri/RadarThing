"use client";

import { useSignIn } from "@clerk/nextjs";
import {
  cloneElement,
  useState,
  type MouseEventHandler,
  type ReactElement,
} from "react";

interface ClickableChildProps {
  onClick?: MouseEventHandler<HTMLElement>;
  disabled?: boolean;
  "aria-busy"?: boolean;
}

interface GoogleSignInButtonProps {
  children: ReactElement<ClickableChildProps>;
  redirectTo?: string;
}

export function GoogleSignInButton({
  children,
  redirectTo,
}: GoogleSignInButtonProps) {
  const { signIn, isLoaded } = useSignIn();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleClick: MouseEventHandler<HTMLElement> = async (event) => {
    children.props.onClick?.(event);

    if (event.defaultPrevented || !isLoaded || !signIn || isRedirecting) {
      return;
    }

    setIsRedirecting(true);

    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete:
          redirectTo ??
          `${window.location.pathname}${window.location.search}${window.location.hash}`,
      });
    } catch (error) {
      console.error("Failed to start Google OAuth", error);
      setIsRedirecting(false);
    }
  };

  return cloneElement(children, {
    onClick: handleClick,
    disabled: children.props.disabled ?? isRedirecting,
    "aria-busy": isRedirecting,
  });
}
