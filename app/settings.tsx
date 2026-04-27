import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#d0d0d0",
        borderRadius: 12,
        backgroundColor: "#ffffff",
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        paddingTop: 60,
        backgroundColor: "#f5f5f5",
      }}
    >
      <Pressable
        onPress={() => router.back()}
        style={{
          alignSelf: "flex-start",
          marginBottom: 16,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: "#111827",
        }}
      >
        <Text style={{ color: "#ffffff", fontWeight: "bold" }}>Back</Text>
      </Pressable>

      <Text style={{ fontSize: 28, fontWeight: "bold", marginBottom: 8 }}>
        Settings & About
      </Text>

      <Text style={{ fontSize: 14, color: "#4b5563", marginBottom: 20, lineHeight: 20 }}>
        Learn how the app works, review the signal logic at a high level, and see
        important information about data and usage.
      </Text>

      <SectionCard title="App Information">
        <Text style={{ fontSize: 15, marginBottom: 8 }}>
          <Text style={{ fontWeight: "bold" }}>App Name:</Text> MAG 7 Tactical Tracker
        </Text>
        <Text style={{ fontSize: 15, marginBottom: 8 }}>
          <Text style={{ fontWeight: "bold" }}>Version:</Text> 1.0.0
        </Text>
        <Text style={{ fontSize: 15 }}>
          <Text style={{ fontWeight: "bold" }}>Data Source:</Text> Sample MAG 7 data
        </Text>
      </SectionCard>

      <SectionCard title="How the App Works">
        <Text style={{ fontSize: 15, marginBottom: 10, lineHeight: 22 }}>
          The app evaluates Magnificent Seven stocks using a rules-based process.
          It looks at long-term trend, relative leadership within the Mag 7 group,
          and tactical conditions that may affect position sizing.
        </Text>

        <Text style={{ fontSize: 15, marginBottom: 8, lineHeight: 22 }}>
          A stock is considered part of the leadership group when it is:
        </Text>

        <Text style={{ fontSize: 15, marginBottom: 6, lineHeight: 22 }}>
          • above its 200-day moving average
        </Text>
        <Text style={{ fontSize: 15, marginBottom: 10, lineHeight: 22 }}>
          • and ranked among the top 3 Mag 7 names by 63-day return
        </Text>

        <Text style={{ fontSize: 15, lineHeight: 22 }}>
          The app then translates those results into action-oriented signals such as
          Buy, Hold, Reduce, Sell, and leverage-related overlays.
        </Text>
      </SectionCard>

      <SectionCard title="Signal Meanings">
        <Text style={{ fontSize: 15, marginBottom: 8, lineHeight: 22 }}>
          <Text style={{ fontWeight: "bold" }}>Buy:</Text> Start a core position.
        </Text>
        <Text style={{ fontSize: 15, marginBottom: 8, lineHeight: 22 }}>
          <Text style={{ fontWeight: "bold" }}>Hold:</Text> Maintain the current core position.
        </Text>
        <Text style={{ fontSize: 15, marginBottom: 8, lineHeight: 22 }}>
          <Text style={{ fontWeight: "bold" }}>Reduce:</Text> Trim position size because leadership has weakened.
        </Text>
        <Text style={{ fontSize: 15, marginBottom: 8, lineHeight: 22 }}>
          <Text style={{ fontWeight: "bold" }}>Sell:</Text> Exit the core position.
        </Text>
        <Text style={{ fontSize: 15, marginBottom: 8, lineHeight: 22 }}>
          <Text style={{ fontWeight: "bold" }}>Leverage On:</Text> Add a tactical leveraged overlay if conditions qualify.
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 22 }}>
          <Text style={{ fontWeight: "bold" }}>Leverage Off:</Text> Remove the tactical leveraged overlay.
        </Text>
      </SectionCard>

      <SectionCard title="Portfolio Planning">
        <Text style={{ fontSize: 15, marginBottom: 10, lineHeight: 22 }}>
          The Portfolio Planner lets you estimate how to deploy your full portfolio
          or just newly added cash.
        </Text>
        <Text style={{ fontSize: 15, marginBottom: 10, lineHeight: 22 }}>
          The app uses whole-share estimates by default, so target dollar amounts
          may not be invested exactly. Some cash may remain unused after rounding down
          to whole shares.
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 22 }}>
          This helps keep the planning realistic for actual stock purchases.
        </Text>
      </SectionCard>

      <SectionCard title="Important Note">
        <Text style={{ fontSize: 15, lineHeight: 22 }}>
          This app is for informational and educational use. It is not financial advice.
          Users should review any investment decisions carefully and consider their own
          financial situation, goals, and risk tolerance.
        </Text>
      </SectionCard>

      <SectionCard title="Support">
        <Text style={{ fontSize: 15, marginBottom: 8 }}>
          Support Email: support@example.com
        </Text>
        <Text style={{ fontSize: 15 }}>
          Privacy Policy: Coming soon
        </Text>
      </SectionCard>
    </ScrollView>
  );
}