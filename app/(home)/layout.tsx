import { DataProvider } from '@/components/DataProvider';

// The home page is a full-bleed brand moment, outside the sidebar shell.
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <DataProvider>{children}</DataProvider>;
}
