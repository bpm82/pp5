(() => {
  "use strict";

  // Blue 1 is the adopted display. Other levels are available to PC DEBUG.
  const defs = document.getElementById("mapColorFilters");
  if (!defs) return;
  const svgNamespace = "http://www.w3.org/2000/svg";
  function element(tag, attributes = {}) {
    const node = document.createElementNS(svgNamespace, tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    return node;
  }
  const rgb = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const mix = (from, to, amount) => from.map((value, index) => value + (to[index] - value) * amount);
  const palettes = [
    ["#cfe3e7", "#e9f3f2", "#245448"],
    ["#c4dbe2", "#dbeaf0", "#245448"],
    ["#b8d2de", "#cee1eb", "#245448"],
    ["#acccda", "#bdd7e7", "#245448"],
    ["#9fc4d7", "#afcde2", "#245448"]
  ];
  palettes.forEach(([outsideHex, insideHex, edgeHex], index) => {
    const outside = rgb(outsideHex), inside = rgb(insideHex), edge = rgb(edgeHex);
    const filter = element("filter", {
      id: `d-map-digital-${index + 1}`, x: "0", y: "0", width: "100%", height: "100%",
      "color-interpolation-filters": "sRGB"
    });
    filter.append(element("feColorMatrix", {
      type: "matrix", values: "0 0 1 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 1 0"
    }));
    const samples = Array.from({ length: 257 }, (_, index) => {
      const value = index / 256;
      if (value <= .83) return edge;
      if (value < .90) return mix(edge, inside, (value - .83) / .07);
      if (value <= .955) return inside;
      if (value < .985) {
        const blend = (value - .955) / .03;
        return mix(inside, outside, blend * blend * (3 - 2 * blend));
      }
      return outside;
    });
    const transfer = element("feComponentTransfer", { result: "mappedDrawing" });
    ["R", "G", "B"].forEach((channel, index) => transfer.append(element(`feFunc${channel}`, {
      type: "table", tableValues: samples.map(color => color[index].toFixed(5)).join(" ")
    })));
    filter.append(transfer);
    filter.append(element("feMorphology", { in: "SourceAlpha", operator: "dilate", radius: "1.6", result: "expandedFootprint" }));
    filter.append(element("feComposite", { in: "expandedFootprint", in2: "SourceAlpha", operator: "out", result: "footprintRim" }));
    filter.append(element("feFlood", { "flood-color": "#4f9cba", "flood-opacity": ".42", result: "rimColor" }));
    filter.append(element("feComposite", { in: "rimColor", in2: "footprintRim", operator: "in", result: "footprintOutline" }));
    filter.append(element("feOffset", { in: "SourceAlpha", dx: "1.2", dy: "2", result: "offsetFootprint" }));
    filter.append(element("feComposite", { in: "offsetFootprint", in2: "SourceAlpha", operator: "out", result: "footprintStep" }));
    filter.append(element("feFlood", { "flood-color": "#356f84", "flood-opacity": ".18", result: "stepColor" }));
    filter.append(element("feComposite", { in: "stepColor", in2: "footprintStep", operator: "in", result: "footprintDepth" }));
    const merge = element("feMerge");
    ["footprintDepth", "footprintOutline", "mappedDrawing"].forEach(name => merge.append(element("feMergeNode", { in: name })));
    filter.append(merge);
    defs.append(filter);
  });

  function modelFilter(id, values) {
    const node = element("filter", {
      id, x: "0", y: "0", width: "100%", height: "100%",
      "color-interpolation-filters": "sRGB"
    });
    node.append(element("feColorMatrix", { type: "matrix", values }));
    defs.append(node);
  }
  modelFilter("d-model-blue-1", ".94 0 0 0 .003  0 .99 0 0 .004  0 0 1.03 0 .018  0 0 0 1 0");
  modelFilter("d-model-blue-2", ".84 0 0 0 .005  0 .98 0 0 .006  0 0 1.06 0 .045  0 0 0 1 0");
  modelFilter("d-model-blue-glass", ".78 0 0 0 .005  0 .96 0 0 .005  0 0 1.06 0 .045  0 0 0 1 0");
  // Photographic SPZ needs its own grade; keep some source chroma in both.
  const splatTints = [
    { source: .35, tint: [.82, .91, 1.08], offset: [.003, .007, .045] },
    { source: .20, tint: [.75, .90, 1.12], offset: [.003, .007, .055] }
  ];
  splatTints.forEach(({ source, tint, offset }, index) => {
    const luminance = [.2126, .7152, .0722];
    const values = tint.flatMap((scale, channel) => [
      ...luminance.map((weight, input) => (1 - source) * scale * weight + (input === channel ? source : 0)),
      0, offset[channel]
    ]).concat([0, 0, 0, 1, 0]).join(" ");
    modelFilter(`d-splat-blue-${index + 1}`, values);
  });

  // Changing the display leaves the current model, camera and game progress alone.
  let level = 1;
  window.DMapDisplay = Object.freeze({
    getLevel: () => level,
    setLevel(value) {
      level = Number.isInteger(value) && value >= 1 && value <= 5 ? value : 1;
      document.body.dataset.mapBlueLevel = String(level);
      return level;
    }
  });
  window.DMapDisplay.setLevel(1);
})();
