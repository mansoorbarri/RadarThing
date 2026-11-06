import Image from "next/image";

type SystemThemeLogoProps = Omit<
  React.ComponentProps<typeof Image>,
  "src" | "alt"
> & {
  alt?: string;
};

/**
 * The RadarThing logo. The site is always dark now, so this renders the white
 * logo immediately (it used to wait for the client theme, which made the logo
 * pop in after load).
 */
export function SystemThemeLogo({
  alt = "RadarThing",
  ...props
}: SystemThemeLogoProps) {
  return <Image src="/logo-white.svg" alt={alt} {...props} />;
}
