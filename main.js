Hooks.once("babele.init", (babele) => {
  babele.register({
    module: "decito-dnd5e-pt-br",
    lang: "pt-BR",
    dir: "compendium",
  });

  babele.registerConverters({
      "imperialToMetric": Converters.imperialToMetric(),
      "tokens": Converters.tokens() 
  });
});

function convertMetricLength() {
	return game.settings.get("dnd5e", "metricLengthUnits");
}

function convertMetricWeight() {
	return game.settings.get("dnd5e", "metricWeightUnits");
}

function convertMetricVolume() {
	return game.settings.get("dnd5e", "metricVolumeUnits");
}

export class Converters {

    static imperialToMetric() {
        return (value, translation, data) => Converters._imperialToMetric(value, translation, data);
    }

    static _imperialToMetric(value, translation, data) {
        const conversion = Converters.conversionInfo[value?.units ?? value?.template?.units ?? "ft"];
        const converted = {};
        if (conversion) {
            if (value?.value) converted.value = conversion.converter(value.value);
            if (value?.long) converted.long = conversion.converter(value.long);
            if (value?.reach) converted.reach = conversion.converter(value.reach);
            if (value?.distance) converted.distance = conversion.converter(value.distance);
            if (value?.burrow) converted.burrow = conversion.converter(value.burrow);
            if (value?.climb) converted.climb = conversion.converter(value.climb);
            if (value?.swim) converted.swim = conversion.converter(value.swim);
            if (value?.walk) converted.walk = conversion.converter(value.walk);
            if (value?.fly) converted.fly = conversion.converter(value.fly);
            if (value?.bright) converted.bright = conversion.converter(value.bright);
            if (value?.dim) converted.dim = conversion.converter(value.dim);
            if (value?.range) converted.range = conversion.converter(value.range);
            if (value?.units) converted.units = conversion.units;
            
            if (value?.template) {
                converted.template = {
                    ...Object.fromEntries(
                        ["size", "height", "width"]
                            .map(k => [k, conversion.converter(value.template[k])])
                    ),
                    units: conversion.units
                };
            }
            if (value?.ranges) {
                converted.ranges = Object.fromEntries(
                    ["darkvision", "blindsight", "tremorsense", "truesight"]
                        .map(k => [k, conversion.converter(value.ranges[k])])
                );
            }
            if (value?.paces) {
                converted.paces = Object.fromEntries(
                    ["air", "land", "water"].map(k => [k, conversion.converter(value.paces[k])])
                );
            }
            if (value?.speeds) {
                converted.speeds = Object.fromEntries(
                    ["air", "land", "water"].map(k => [k, conversion.converter(value.speeds[k])])
                );
            }
            
            const detectionModeKeys = new Set(["lightPerception", "basicSight", "seeAll", "feelTremor", "blindsight", "senseInvisibility", "seeInvisibility", "senseAll"]);
            if (Object.keys(value ?? {}).some(k => detectionModeKeys.has(k))) {
                return Object.fromEntries(
                    Object.entries(value).map(([k, mode]) => [
                        k,
                        mode?.range ? { ...mode, range: conversion.converter(mode.range) } : mode
                    ])
                );
            }
            if (value && typeof value === "object" && !Array.isArray(value) &&
                Object.values(value).every(v => v && typeof v === "object" && "value" in v && Object.keys(v).length === 1)) {
                return Object.fromEntries(
                    Object.entries(value).map(([k, entry]) => [
                        k, { value: conversion.converter(entry.value) }
                    ])
                );
            }
        }
        
        if (value?.affects?.special) converted.affects = { special: translation ?? value.affects.special };
        if (value?.special) converted.special = translation ?? value.special;

        return Object.keys(converted).length ? foundry.utils.mergeObject(value, converted, { inplace: false }) : value;
    }

    static get conversionInfo() {
        return {
            "ft": { converter: Converters.footsToMeters, units: convertMetricLength() ? "m" : "ft" },
            "mi": { converter: Converters.milesToMeters, units: convertMetricLength() ? "km" : "mi" },
            "mph": { converter: Converters.milesToMeters, units: convertMetricLength() ? "kph" : "mph" },
            "lb": { converter: Converters.lbToKg, units: convertMetricWeight() ? "kg" : "lb" },
            "cubicFoot": { converter: Converters.pcToL, units: convertMetricVolume() ? "liter" : "cubicFoot" }
        };
    }

    static footsToMeters(ft) {
        if (!convertMetricLength() || !ft || isNaN(parseInt(ft))) return ft;
        return Converters.round(parseInt(ft) * 0.3);
    }

    static milesToMeters(mi) {
        if (!convertMetricLength() || !mi || isNaN(parseInt(mi))) return mi;
        return Converters.round(parseInt(mi) * 1.5);
    }

    static pcToL(pc) {
        if (!convertMetricVolume() || !pc) return pc;
        return Converters.round(parseInt(pc) * 28.317);
    }

    static lbToKg(lb) {
        if (!convertMetricWeight() || !lb) return lb;
        return parseInt(lb) / 2;
    }

    static round(num) {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    static tokens() {
        return (tokens, translations, data, tc, runtime = {}) => Converters._tokens(tokens, translations, data, tc, runtime);
    }

    static _tokens(tokens, translations, data, tc, runtime = {}) {
        tokens.map(token => {
            return foundry.utils.mergeObject(token, {
                light: Converters._imperialToMetric(token.light),
                sight: Converters._imperialToMetric(token.sight)
            });
        });

        if (!translations) return tokens;

        const documentMappings = 
            runtime?.currentCompendium?.()?.documentMappings
            ?? game.babele.documentMappings;
        
        const actorMapping = documentMappings.mappingFor("Actor");

        const fakeCompendium = {
            documentMappings,
            translationMatchStrategies: () => []
        };

        const enrichedRuntime = typeof runtime?.child === "function"
            ? runtime.child({ currentCompendium: fakeCompendium })
            : { 
                globalPacks: runtime?.globalPacks ?? new foundry.utils.Collection(),
                localPacks: runtime?.localPacks ?? new foundry.utils.Collection(),
                currentCompendium: fakeCompendium
            };

        return tokens.map(token => {
            const translation = translations[token._id] || translations[token.name];
            if (!translation) return token;

            const delta = token.delta ?? {};
            let deltaTranslated = delta;
            actorMapping.prepare(delta, translation, enrichedRuntime);
            const payload = actorMapping.map(delta, translation, enrichedRuntime);
            deltaTranslated = foundry.utils.mergeObject(
                foundry.utils.deepClone(delta),
                payload,
                { inplace: false }
            );

            return foundry.utils.mergeObject(token, {
                name: translation.name ?? token.name,
                delta: deltaTranslated
            }, { inplace: false });
        });
    }
}
