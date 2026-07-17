import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ExploreNav, type ExploreTab } from "../../components/explore/explore-nav";
import LibraryView from "../../components/explore/library-view";
import ShelfView from "../../components/explore/shelf-view";
import CollectionsView from "../../components/explore/collections-view";
import CapsulesView from "../../components/explore/capsules-view";

const TABS: ExploreTab[] = ["library", "shelf", "collections", "capsules"];

// Explore = the archive + keepsakes cluster, with one shared sub-nav across
// Library · Shelf · Collections · Capsules — mirroring the web. An optional
// `?tab=` (from the ☰ menu) opens the right sub-tab.
export default function Explore() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initial = (TABS as string[]).includes(params.tab ?? "")
    ? (params.tab as ExploreTab)
    : "library";
  const [tab, setTab] = useState<ExploreTab>(initial);

  // Jump to the requested sub-tab when the menu navigates here with a new ?tab=.
  useEffect(() => {
    if (params.tab && (TABS as string[]).includes(params.tab)) {
      setTab(params.tab as ExploreTab);
    }
  }, [params.tab]);

  return (
    <View className="flex-1 bg-background">
      <ExploreNav tab={tab} onChange={setTab} />
      {tab === "library" ? (
        <LibraryView />
      ) : tab === "shelf" ? (
        <ShelfView />
      ) : tab === "collections" ? (
        <CollectionsView />
      ) : (
        <CapsulesView />
      )}
    </View>
  );
}
