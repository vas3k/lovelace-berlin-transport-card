// Berlin Transport Card

class BerlinTransportCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({
      mode: "open",
    });
  }

  /* This is called every time sensor is updated */
  set hass(hass) {
    this._hass = hass;

    const config = this.config;
    const maxEntries = config.max_entries || 10;
    const showStopName =
      config.show_stop_name || config.show_stop_name === undefined;
    const entityIds = config.entity ? [config.entity] : config.entities || [];
    const showCancelled =
      config.show_cancelled || config.show_cancelled === undefined;
    const showDelay = config.show_delay || config.show_delay === undefined;
    const showAbsoluteTime =
      config.show_absolute_time || config.show_absolute_time === undefined;
    const showRelativeTime =
      config.show_relative_time || config.show_relative_time === undefined;
    const includeWalkingTime =
      config.include_walking_time || config.include_walking_time === undefined;
    const showWarnings =
      config.show_warnings || config.show_warnings === undefined;

    let content = "";

    for (const entityId of entityIds) {
      const entity = hass.states[entityId];
      if (!entity) {
        content += `<div class="not-found">Entity ${entityId} not found.</div>`;
      } else {
        if (showStopName) {
          content += `<div class="stop">${entity.attributes.friendly_name}</div>`;
        }

        if (entity.state === "unavailable") {
          content += `<div class="not-found">No results due to API error.</div>`;
        } else {
          const departures = entity.attributes.departures.slice(0, maxEntries);
          const warningCounts = {};
          const warningObjects = {};

          // Pre-process warnings: filter redundant and count occurrences
          departures.forEach((departure) => {
            if (departure.cancelled && !showCancelled) return;
            let warnings = departure.warnings || [];
            if (typeof warnings === "object" && !Array.isArray(warnings))
              warnings = [warnings];

            const seenInThisDeparture = new Set();
            warnings.forEach((w) => {
              const summary = typeof w === "object" ? w.summary : w;
              if (
                summary &&
                (summary.toLowerCase() === "trip canceled" ||
                  summary.toLowerCase() === "trip cancelled")
              )
                return;

              const id = typeof w === "object" ? w.id || w.summary : w;
              if (seenInThisDeparture.has(id)) return;
              seenInThisDeparture.add(id);

              warningCounts[id] = (warningCounts[id] || 0) + 1;
              warningObjects[id] = w;
            });
          });

          // Global warnings (appear in more than one line)
          const globalWarnings = Object.keys(warningCounts).filter(
            (id) => warningCounts[id] > 1,
          );
          const seenGlobalSummaries = new Set();
          const uniqueGlobalWarnings = globalWarnings.filter((id) => {
            const w = warningObjects[id];
            const summary = typeof w === "object" ? w.summary : w;
            if (seenGlobalSummaries.has(summary)) return false;
            seenGlobalSummaries.add(summary);
            return true;
          });

          if (showWarnings && uniqueGlobalWarnings.length > 0) {
            content +=
              `<div class="warnings global-warnings">` +
              uniqueGlobalWarnings
                .map((id) => {
                  const w = warningObjects[id];
                  const summary = typeof w === "object" ? w.summary : w;
                  return `<div class="warning-item"><ha-icon icon="mdi:alert-circle" class="warning-icon"></ha-icon>${summary}</div>`;
                })
                .join("") +
              `</div>`;
          }

          const timetable = departures.map((departure) => {
            if (departure.cancelled && !showCancelled) return "";

            const delay = departure.delay === null ? `` : departure.delay / 60;
            const delayDiv =
              delay > 0
                ? `<div class="delay delay-pos">+${delay}</div>`
                : `<div class="delay delay-neg">${delay === 0 ? "+0" : delay}</div>`;
            const currentDate = new Date().getTime();
            const timestamp = new Date(departure.timestamp).getTime();
            const walkingTime = includeWalkingTime
              ? departure.walking_time || 0
              : 0;
            const relativeTime =
              Math.round((timestamp - currentDate) / (1000 * 60)) - walkingTime;
            const relativeTimeDiv = `<div class="relative-time">${relativeTime}&prime;&nbsp;</div>`;

            let warnings = departure.warnings || [];
            if (typeof warnings === "object" && !Array.isArray(warnings))
              warnings = [warnings];

            // Filter: keep only if it's NOT a global warning and NOT a "Trip canceled" warning
            const localWarnings = warnings.filter((w) => {
              const summary = typeof w === "object" ? w.summary : w;
              if (
                summary &&
                (summary.toLowerCase() === "trip canceled" ||
                  summary.toLowerCase() === "trip cancelled")
              )
                return false;
              const id = typeof w === "object" ? w.id || w.summary : w;
              return warningCounts[id] === 1;
            });

            const warningsDiv =
              showWarnings && localWarnings.length > 0
                ? `<div class="warnings">${localWarnings
                    .map((w) => {
                      const summary = typeof w === "object" ? w.summary : w;
                      return `<div class="warning-item"><ha-icon icon="mdi:alert-circle" class="warning-icon"></ha-icon>${summary}</div>`;
                    })
                    .join("")}</div>`
                : "";

            const cancelledClass = departure.cancelled
              ? "departure-cancelled"
              : "";

            return `<div class="departure">
                                <div class="line ${cancelledClass}">
                                    <div class="line-icon" style="background-color: ${departure.color}">${departure.line_name}</div>
                                </div>
                                <div class="direction">
                                    <div class="${cancelledClass}">${departure.direction}</div>
                                    ${warningsDiv}
                                </div>
                                <div class="time ${cancelledClass}">${showRelativeTime ? relativeTimeDiv : ""}${showAbsoluteTime ? departure.time : ""}${showDelay ? delayDiv : ""}</div>
                            </div>`;
          });

          content +=
            `<div class="departures">` + timetable.join("\n") + `</div>`;
        }
      }
    }

    this.shadowRoot.getElementById("container").innerHTML = content;
  }

  get hass() {
    return this._hass;
  }

  /* This is called only when config is updated */
  setConfig(config) {
    if (!config.entity && !config.entities?.length) {
      throw new Error("You need to define entities");
    }

    const root = this.shadowRoot;
    if (root.lastChild) root.removeChild(root.lastChild);

    this.config = config;

    const card = document.createElement("ha-card");
    const content = document.createElement("div");
    const style = document.createElement("style");

    style.textContent = `
            ha-card {
                height: 100%;
                padding: 10px;
                line-height: 2em;
            }
            .container {
                height: 100%;
                overflow: hidden hidden;
                margin-bottom: -10px;
            }
            .stop {
                opacity: 0.6;
                text-align: left;
                padding: 10px 10px 10px 5px;
            }
            .departures {
                padding-bottom: 10px;
            }
            .departure {
                padding-top: 2px;
                padding-bottom: 10px;
                display: flex;
                flex-direction: row;
                flex-wrap: nowrap;
                align-items: flex-start;
                gap: 20px;
            }
            .departure-cancelled {
                text-decoration: line-through;
                filter: grayscale(50%);
            }
            .line {
                min-width: 70px;
                text-align: right;
            }
            .line-icon {
                display: inline-block;
                border-radius: 20px;
                padding: 7px 10px 5px;
                font-size: 120%;
                font-weight: 700;
                line-height: 1em;
                color: #FFFFFF;
                text-align: center;
            }
            .direction {
                align-self: center;
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }
            .time {
                align-self: flex-start;
                font-weight: 700;
                line-height: 2em;
                padding-right: 10px;
                display: flex;
            }
            .delay {
               font-size: 70%;
               line-height: 2em;
               text-align: right;
               min-width: 2ch;
            }
            .delay-pos {
               color: #8B0000;
            }
            .delay-neg {
               color: #006400;
            }
            .relative-time {
               font-style: italic;
            }
            .warnings {
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding-top: 5px;
            }
            .warning-item {
                font-size: 80%;
                line-height: 1.2em;
                color: var(--warning-color, #ff9800);
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .warning-icon {
                --mdc-icon-size: 14px;
            }
            .global-warnings {
                padding-bottom: 10px;
                padding-left: 5px;
            }
        `;

    content.id = "container";
    content.className = "container";
    card.header = config.title;
    card.appendChild(style);
    card.appendChild(content);

    root.appendChild(card);
  }

  // The height of the card.
  getCardSize() {
    return 5;
  }

  // The rules for sizing your card in the grid in sections view
  getGridOptions() {
    return {
      rows: 5,
    };
  }

  static getConfigElement() {
    return document.createElement("berlin-transport-card-editor");
  }

  static getStubConfig() {
    return {
      show_stop_name: true,
      max_entries: 10,
      entities: [],
      show_cancelled: true,
      show_delay: true,
      show_absolute_time: true,
      show_relative_time: true,
      include_walking_time: false,
      show_warnings: true,
    };
  }
}

class BerlinTransportCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({
      mode: "open",
    });
  }

  _computeLabel(field) {
    const labels = {
      entities: "Stops",
      show_stop_name: "Show stop name",
      max_entries: "Maximum departures",
      show_cancelled: "Show cancelled departures",
      show_delay: "Show delay",
      show_absolute_time: "Show absolute time of departures",
      show_relative_time: "Show relative time of departures",
      include_walking_time:
        "Subtract walking time from relative time of departures",
      show_warnings: "Show warnings (e.g. service disruptions)",
    };

    return labels[field.name] ? labels[field.name] : field.name;
  }

  setConfig(config) {
    this.config = config;

    if (this.shadowRoot.lastChild) {
      this.shadowRoot.removeChild(this.shadowRoot.lastChild);
    }

    const form = document.createElement("ha-form");
    form.data = this.config;
    form.hass = this.hass;
    form.schema = [
      {
        name: "entities",
        label: "Haltestelle",
        selector: {
          entity: {
            filter: { integration: "berlin_transport" },
            multiple: true,
          },
        },
      },
      { name: "show_stop_name", selector: { boolean: {} } },
      {
        name: "max_entries",
        selector: { number: { min: 1, max: 100, mode: "box" } },
      },
      { name: "show_cancelled", selector: { boolean: {} } },
      { name: "show_delay", selector: { boolean: {} } },
      { name: "show_absolute_time", selector: { boolean: {} } },
      { name: "show_relative_time", selector: { boolean: {} } },
      { name: "include_walking_time", selector: { boolean: {} } },
      { name: "show_warnings", selector: { boolean: {} } },
    ];
    form.computeLabel = this._computeLabel;
    form.addEventListener("value-changed", this._valueChanged);
    this.shadowRoot.appendChild(form);
  }

  _valueChanged(evt) {
    this.config = evt.detail.value;

    const event = new Event("config-changed", {
      bubbles: true,
      composed: true,
    });
    event.detail = { config: this.config };
    this.dispatchEvent(event);
  }
}

if (!customElements.get("berlin-transport-card")) {
  customElements.define("berlin-transport-card", BerlinTransportCard);
}
if (!customElements.get("berlin-transport-card-editor")) {
  customElements.define(
    "berlin-transport-card-editor",
    BerlinTransportCardEditor,
  );
}

console.info(
  "%c  BERLIN-TRANSPORT-CARD  %c Loaded ",
  "color: white; background: #000000; font-weight: 700;",
  "color: #000000; background: white; font-weight: 700;",
);

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "berlin-transport-card")) {
  window.customCards.push({
    type: "berlin-transport-card",
    name: "Berlin Transport Card",
    preview: false,
    description:
      "Card for Berlin (BVG) and Brandenburg (VBB) transport integration",
    documentationURL: "https://github.com/vas3k/lovelace-berlin-transport-card",
  });
}
