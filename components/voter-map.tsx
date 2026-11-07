"use client";
import ui from "./shared.module.css";
import styles from "./voter-map.module.css";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { Voter } from "@/lib/types";
import { fullName, statusLabels } from "@/lib/types";
import { Icon } from "./icon";
const colors: Record<string, string> = {
  uncontacted: "#45657a",
  interested: "#8362bb",
  cured: "#31836b",
  not_interested: "#929b9e",
  no_response: "#c29241",
};
export function VoterMap({
  voters,
  selected = [],
  onSelect,
  className = "",
  canvasClassName = "",
}: {
  voters: Voter[];
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  className?: string;
  canvasClassName?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markers = useRef<Leaflet.LayerGroup | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const fitted = useRef("");
  const [ready, setReady] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        leaflet.current = L;
        map.current = L.map(container.current, {
          boxZoom: false,
          scrollWheelZoom: false,
        }).setView([34.019, -118.273], 12);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          // Identify the app origin without disclosing a public batch's bearer token.
          referrerPolicy: "origin",
          maxZoom: 19,
        })
          .addTo(map.current)
          .on("tileerror", () =>
            setError(
              "Map tiles are unavailable. Voters can still be selected from the table.",
            ),
          );
        markers.current = L.layerGroup().addTo(map.current);
        observer = new ResizeObserver(() => {
          // Let layout finish before Leaflet changes the map's dimensions.
          if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            resizeFrame = null;
            map.current?.invalidateSize();
          });
        });
        observer.observe(container.current);
        setReady(true);
      })
      .catch(() =>
        setError(
          "The map could not load. Use the voter table to select voters.",
        ),
      );
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    const layer = markers.current;
    if (!ready || !L || !m || !layer) return;
    layer.clearLayers();
    const groups = new Map<string, Voter[]>();
    for (const v of voters) {
      const key = `${v.latitude},${v.longitude}`;
      groups.set(key, [...(groups.get(key) || []), v]);
    }
    for (const group of groups.values()) {
      const v = group[0];
      const active = group.some((voter) => selected.includes(voter.id));
      const color = active
        ? "#193d33"
        : colors[
            group.find((voter) => voter.status === "interested")?.status ||
              v.status ||
              "uncontacted"
          ];
      const marker = L.marker([v.latitude, v.longitude], {
        icon: L.divIcon({
          className: styles.voterMarkerWrap,
          html: `<span class="${styles.voterMarker} ${active ? styles.selected : ""}" style="background:${color}">${group.length > 1 ? group.length : active ? "✓" : ""}</span>`,
          iconSize: [27, 27],
          iconAnchor: [13, 13],
        }),
        keyboard: true,
        title: group.map(fullName).join(", "),
      });
      const popup = document.createElement("div");
      popup.className = styles.mapPopup;
      for (const person of group) {
        const entry = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = fullName(person);
        entry.append(name);
        const street = document.createElement("p");
        street.textContent = [person.street, person.unit]
          .filter(Boolean)
          .join(", ");
        entry.append(street);
        const status = document.createElement("small");
        status.textContent = statusLabels[person.status || "uncontacted"];
        entry.append(status);
        if (onSelect) {
          const button = document.createElement("button");
          button.className = styles.mapSelectButton;
          button.textContent = selected.includes(person.id)
            ? "Deselect voter"
            : "Select voter";
          button.onclick = () => onSelect([person.id]);
          entry.append(button);
        }
        popup.append(entry);
      }
      marker.bindPopup(popup).addTo(layer);
    }
    const identity = voters.map((v) => v.id).join(",");
    if (voters.length && fitted.current !== identity) {
      m.fitBounds(
        L.latLngBounds(
          voters.map((v) => [v.latitude, v.longitude] as [number, number]),
        ),
        { padding: [40, 40], maxZoom: 15 },
      );
      fitted.current = identity;
    }
  }, [ready, voters, selected, onSelect]);
  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!ready || !L || !m) return;
    if (!selecting) {
      m.dragging.enable();
      return;
    }
    m.dragging.disable();
    let start: Leaflet.LatLng | null = null;
    let box: Leaflet.Rectangle | null = null;
    function down(e: Leaflet.LeafletMouseEvent) {
      start = e.latlng;
    }
    function move(e: Leaflet.LeafletMouseEvent) {
      if (!start || !L || !m) return;
      const bounds = L.latLngBounds(start, e.latlng);
      if (box) box.setBounds(bounds);
      else
        box = L.rectangle(bounds, {
          color: "#244d40",
          weight: 2,
          fillOpacity: 0.12,
        }).addTo(m);
    }
    function up(e: Leaflet.LeafletMouseEvent) {
      if (start && L) {
        const bounds = L.latLngBounds(start, e.latlng);
        onSelect?.(
          voters
            .filter((v) => bounds.contains([v.latitude, v.longitude]))
            .map((v) => v.id),
        );
      }
      if (box) m?.removeLayer(box);
      box = null;
      start = null;
      setSelecting(false);
    }
    m.on("mousedown", down).on("mousemove", move).on("mouseup", up);
    return () => {
      m.off("mousedown", down).off("mousemove", move).off("mouseup", up);
      if (box) m.removeLayer(box);
      m.dragging.enable();
    };
  }, [ready, selecting, voters, onSelect]);
  function fit() {
    const L = leaflet.current;
    if (L && voters.length)
      map.current?.fitBounds(
        L.latLngBounds(
          voters.map((v) => [v.latitude, v.longitude] as [number, number]),
        ),
        { padding: [40, 40], maxZoom: 15 },
      );
  }
  return (
    <div
      className={`${styles.mapPanel} ${selecting ? styles.selecting : ""} ${className}`}
    >
      <div
        ref={container}
        className={`${styles.mapCanvas} ${canvasClassName}`}
        aria-label={`Map of ${voters.length} voter locations`}
      />
      <div className={styles.mapTopControls}>
        {onSelect && (
          <button
            className={`${ui.button} ${styles.button} ${ui.small} ${selecting ? ui.primary : ""}`}
            onClick={() => setSelecting(!selecting)}
            aria-pressed={selecting}
          >
            <Icon name="plus" />
            {selecting ? "Drag to select · Cancel" : "Select an area"}
          </button>
        )}
        <button
          className={`${ui.button} ${styles.button} ${ui.small}`}
          onClick={fit}
        >
          <Icon name="map" />
          Fit voters
        </button>
      </div>
      {error && (
        <div className={styles.mapError} role="status">
          {error}
        </div>
      )}
      {!voters.length && (
        <div className={styles.mapEmpty}>Voter locations will appear here</div>
      )}
      <div className={styles.mapLegend}>
        {[
          "uncontacted",
          "interested",
          "cured",
          "no_response",
          "not_interested",
        ].map((s) => (
          <span key={s}>
            <i style={{ background: colors[s] }} />
            {statusLabels[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
