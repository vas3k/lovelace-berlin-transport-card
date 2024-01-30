// Berlin Transport Card

class BerlinTransportCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({
            mode: 'open'
        });
    }

    /* This is called every time sensor is updated */
    set hass(hass) {

        const config = this.config;
        const maxEntries = config.max_entries || 10;
        const showStopName = config.show_stop_name || (config.show_stop_name === undefined);
        const entityIds = config.entity ? [config.entity] : config.entities || [];
        const showCancelled = config.show_cancelled || (config.show_cancelled === undefined);
        const showDelay = config.show_delay || (config.show_delay === undefined);
        const showAbsoluteTime = config.show_absolute_time || (config.show_absolute_time === undefined);
        const showRelativeTime = config.show_relative_time || (config.show_relative_time === undefined);
        const includeWalkingTime = config.include_walking_time || (config.include_walking_time === undefined);

        let content = "";

        for (const entityId of entityIds) {
            const entity = hass.states[entityId];
            if (!entity) {
                throw new Error("Entity State Unavailable");
            }

            if (showStopName) {
                content += `<div class="stop">${entity.attributes.friendly_name}</div>`;
            }

            const timetable = entity.attributes.departures.slice(0, maxEntries).map((departure) => {
            const delay = departure.delay === 'null' ? `` : departure.delay / 60;
            const delayDiv = delay > 0 ? `<div class="delay delay-pos">+${delay}</div>`: `<div class="delay delay-neg">${delay === 0 ? '+0' : delay}</div>`;
            const currentDate = new Date().getTime();
            const timestamp = new Date(departure.timestamp).getTime();
            const walkingTime = includeWalkingTime ? departure.walking_time : 0;
            const relativeTime = Math.round((timestamp - currentDate) / (1000 * 60)) - walkingTime;
            const relativeTimeDiv = `<div class="relative-time">${relativeTime}&prime;&nbsp;</div>`;

            return departure.cancelled && !showCancelled ? `` :
                `<div class="${departure.cancelled ? 'departure-cancelled' : 'departure'}">
                    <div class="line">
                        <div class="line-icon" style="background-color: ${departure.color}">${departure.line_name}</div>
                    </div>
                    <div class="direction">${departure.direction}</div>
                    <div class="time">${showRelativeTime ? relativeTimeDiv : ''}${showAbsoluteTime ? departure.time : ''}${showDelay ? delayDiv : ''}</div>
                </div>`
            });

            content += `<div class="departures">` + timetable.join("\n") + `</div>`;
        }

       this.shadowRoot.getElementById('container').innerHTML = content;
    }

    /* This is called only when config is updated */
    setConfig(config) {
        const root = this.shadowRoot;
        if (root.lastChild) root.removeChild(root.lastChild);

        this.config = config;

        const card = document.createElement('ha-card');
        const content = document.createElement('div');
        const style = document.createElement('style');
  
        style.textContent = `
            .container {
                padding: 10px;
                font-size: 130%;
                line-height: 1.5em;
            }
            .stop {
                opacity: 0.6;
                font-weight: 400;
                width: 100%;
                text-align: left;
                padding: 10px 10px 5px 5px;
            }      
            .departures {
                width: 100%;
                font-weight: 400;
                line-height: 1.5em;
                padding-bottom: 20px;
            }
            .departure {
                padding-top: 10px;
                display: flex;
                flex-direction: row;
                flex-wrap: nowrap;
                align-items: flex-start;
                gap: 20px;
            }
            .departure-cancelled {
                text-decoration: line-through;
                filter: grayscale(50%);
                padding-top: 10px;
                display: flex;
                flex-direction: row;
                flex-wrap: nowrap;
                align-items: flex-start;
                gap: 20px;
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
            }
            .time {
                align-self: flex-start;
                font-weight: 700;
                line-height: 2em;
                padding-right: 10px;
                display: flex;
            }
            .delay {
               line-height: 2em;
               font-size: 70%;
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
}
  
customElements.define('berlin-transport-card', BerlinTransportCard);
