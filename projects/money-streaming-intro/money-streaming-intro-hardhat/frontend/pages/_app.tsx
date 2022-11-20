import '../styles/globals.css'
//import 'antd/dist/antd.css';
import type { AppProps } from 'next/app';
import { WagmiConfig, createClient, chain } from "wagmi";
import { ConnectKitProvider, ConnectKitButton, getDefaultClient } from "connectkit";
import { Toaster } from 'react-hot-toast';

const client = createClient(getDefaultClient({
    appName: "Money Streamer",
    alchemyId: process.env.NEXT_PUBLIC_ALCHEMY_ID_FOR_GOERLI,
    chains: [chain.goerli],
  }),
);

export default function App({ Component, pageProps }: AppProps) {

  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider theme="auto" mode="dark">
        <div
          style={{
            display: 'flex',
            alignItems: 'right',
            justifyContent: 'right',
            margin: '10px'
          }}
        >
          <ConnectKitButton showBalance={true} />
        </div>

        <Component {...pageProps} />
      </ConnectKitProvider>
      <div><Toaster /></div>
    </WagmiConfig>
  );
}
