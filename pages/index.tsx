import Head from "next/head";
import RadarApp from "../components/radar";
export default function Home() {
  return (
    <>
      <Head>
        <title>Qiqi Job Radar</title>
        <meta
          name="description"
          content="A personal job radar for live entertainment, events, production and media in Miami/South Florida and Charleston, South Carolina."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <RadarApp />
    </>
  );
}
