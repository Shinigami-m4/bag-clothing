export default function ContactPage() {
  const linkStyle = { color: "var(--text)", textDecoration: "none" } as const;

  return (
    <div style={{ color: "var(--muted)", lineHeight: 1.9 }}>
      <br />
      <br />
      <div>
        Instagram:{" "}
        <a
          href="https://nam04.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.instagram.com%2Fblackartgoons%3Figsh%3DZ2U0Z3pqdDV6eWVw&data=05%7C02%7Cmaism%40usf.edu%7Cb67150dadd214384094108de83ae6d58%7C741bf7dee2e546df8d6782607df9deaa%7C0%7C0%7C639092982387464603%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=OzFMnSym1DaT%2BW3umZqHJo1DAcaXdpLihjwmJ%2F6vtZo%3D&reserved=0"
          style={linkStyle}
          target="_blank"
          rel="noreferrer"
        >
          <b>@BlackArtGoons</b>
        </a>
      </div>
      <div>
        Email:{" "}
        <a href="mailto:Blackartgoonsllc@gmail.com" style={linkStyle}>
          <b>Blackartgoonsllc@gmail.com</b>
        </a>
      </div>

      <br />
      <div style={{ color: "var(--text)", letterSpacing: "0.08em" }}>ARTIST CONTACTS</div>
      <div>
        Doom:{" "}
        <a href="mailto:Davienmcastro@gmail.com" style={linkStyle}>
          <b>Davienmcastro@gmail.com</b>
        </a>
      </div>
      <div>
        Spill:{" "}
        <a href="mailto:Giothekid007@gmail.com" style={linkStyle}>
          <b>Giothekid007@gmail.com</b>
        </a>
      </div>
      <div>
        Yearn:{" "}
        <a href="mailto:Monteitdaniel1@gmail.com" style={linkStyle}>
          <b>Monteitdaniel1@gmail.com</b>
        </a>
      </div>
    </div>
  );
}
