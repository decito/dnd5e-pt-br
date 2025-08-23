Hooks.on("init", () => {
  if (typeof Babele !== "undefined") {
    Babele.get().register({
      module: "decito-dnd5e-pt-br",
      lang: "pt-BR",
      dir: "compendium",
    });
  }
});
