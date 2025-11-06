document.addEventListener("DOMContentLoaded", () => {
  const selects = Array.from(document.querySelectorAll("[data-component]"));
  const extras = Array.from(document.querySelectorAll('input[name="extras"]'));
  const budgetSlider = /** @type {HTMLInputElement | null} */ (document.getElementById("budget"));
  const budgetValue = document.getElementById("budgetValue");
  const totalPriceEl = document.getElementById("totalPrice");
  const summaryList = document.getElementById("summaryList");
  const coolingBar = document.getElementById("coolingScore");
  const coolingLabel = document.getElementById("coolingLabel");
  const fpsLabel = document.getElementById("fpsLabel");
  const renderLabel = document.getElementById("renderLabel");
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const contactForm = document.querySelector(".contact__form");

  const profiles = {
    gaming: {
      cpu: "ryzen9",
      gpu: "rtx5090",
      ram: "64",
      storage: "4tb",
      extras: ["cooling", "rgb"],
      budget: 380000,
    },
    creator: {
      cpu: "threadripper",
      gpu: "rtx5080",
      ram: "128",
      storage: "8tb",
      extras: ["cooling", "sleeves"],
      budget: 520000,
    },
    pro: {
      cpu: "i9",
      gpu: "radeon",
      ram: "64",
      storage: "4tb",
      extras: ["sleeves"],
      budget: 340000,
    },
  };

  const performance = {
    cpu: {
      ryzen9: { render: 26, boost: 1.08 },
      i9: { render: 24, boost: 1.05 },
      threadripper: { render: 14, boost: 1.18 },
    },
    gpu: {
      rtx5090: { fps: 215, thermal: 0.82 },
      rtx5080: { fps: 180, thermal: 0.75 },
      radeon: { fps: 172, thermal: 0.78 },
    },
    ram: {
      32: { fps: -8, render: 6 },
      64: { fps: 0, render: 0 },
      128: { fps: 5, render: -4 },
    },
    extras: {
      cooling: { thermal: 18, render: -2 },
      sleeves: { thermal: 4, render: 0 },
      rgb: { thermal: -2, render: 0 },
    },
  };

  const summaryNames = {
    cpu: "Процессор",
    gpu: "Графика",
    ram: "ОЗУ",
    storage: "Хранилище",
    extras: "Дополнительно",
  };

  const formatter = new Intl.NumberFormat("ru-RU");

  const formatCurrency = (value) => `${formatter.format(Math.round(value / 100) * 100)} ₽`;

  const setBudgetDisplay = (value) => {
    if (budgetValue) {
      budgetValue.textContent = formatCurrency(value);
    }
  };

  const collectSelection = () => {
    const data = {};
    selects.forEach((select) => {
      const { id } = select;
      const option = select.options[select.selectedIndex];
      data[id] = {
        name: option.textContent,
        price: Number(option.dataset.price || 0),
        value: option.value,
        tdp: Number(option.dataset.tdp || 0),
      };
    });

    data.extras = extras
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => ({
        name: checkbox.nextElementSibling?.textContent || checkbox.value,
        price: Number(checkbox.dataset.price || 0),
        value: checkbox.value,
      }));

    data.budget = Number(budgetSlider?.value || 0);
    return data;
  };

  const updateSummary = () => {
    const selection = collectSelection();
    const baseTotal = Object.values(selection)
      .filter((item) => item && typeof item === "object" && !Array.isArray(item) && item.price)
      .reduce((sum, item) => sum + item.price, 0);

    const extrasTotal = selection.extras.reduce((sum, extra) => sum + extra.price, 0);
    const total = baseTotal + extrasTotal;

    if (totalPriceEl) {
      totalPriceEl.textContent = formatCurrency(total);
    }

    if (summaryList) {
      summaryList.innerHTML = "";
      ["cpu", "gpu", "ram", "storage"].forEach((key) => {
        const item = selection[key];
        if (!item) return;
        summaryList.appendChild(renderSummaryRow(summaryNames[key], item.name || ""));
      });

      if (selection.extras.length) {
        const extrasNames = selection.extras.map((extra) => extra.name).join(" · ");
        summaryList.appendChild(renderSummaryRow(summaryNames.extras, extrasNames));
      }

      const balance = selection.budget - total;
      const balanceRow = document.createElement("div");
      balanceRow.className = "summary-alert";
      balanceRow.textContent =
        balance >= 0
          ? `Вписываемся в бюджет: запас ${formatCurrency(balance)}`
          : `Выход за бюджет на ${formatCurrency(Math.abs(balance))}`;
      summaryList.prepend(balanceRow);
    }

    updateMetrics(selection, total);
  };

  const renderSummaryRow = (label, value) => {
    const row = document.createElement("div");
    row.className = "summary-item";

    const title = document.createElement("span");
    title.className = "summary-item__label";
    title.textContent = label;

    const content = document.createElement("span");
    content.className = "summary-item__value";
    content.textContent = value;

    row.append(title, content);
    return row;
  };

  const updateMetrics = (selection, total) => {
    const cpuPerf = performance.cpu[selection.cpu?.value];
    const gpuPerf = performance.gpu[selection.gpu?.value];
    const ramPerf = performance.ram[selection.ram?.value];

    if (!cpuPerf || !gpuPerf || !ramPerf) {
      return;
    }

    const extrasPerf = selection.extras.map((extra) => performance.extras[extra.value]).filter(Boolean);

    const coolingGain = extrasPerf.reduce((sum, extra) => sum + (extra.thermal || 0), 0);
    const totalTdp = (selection.cpu?.tdp || 0) + (selection.gpu?.tdp || 0);
    const coolingScore = Math.max(
      35,
      Math.min(100, 85 - totalTdp / 10 + coolingGain)
    );

    if (coolingBar) {
      coolingBar.style.width = `${coolingScore}%`;
    }
    if (coolingLabel) {
      coolingLabel.textContent = `${Math.round(coolingScore)}%`;
    }

    let fps = gpuPerf.fps + ramPerf.fps;
    fps *= cpuPerf.boost;
    extrasPerf.forEach((extra) => {
      if (extra?.thermal) {
        fps += extra.thermal * 0.4;
      }
    });

    const budgetInfluence = total > selection.budget ? -5 : 0;
    fps += budgetInfluence;

    if (fpsLabel) {
      fpsLabel.textContent = `${Math.max(120, Math.round(fps))}`;
    }

    let renderTime = cpuPerf.render + ramPerf.render;
    extrasPerf.forEach((extra) => {
      if (typeof extra?.render === "number") {
        renderTime = Math.max(8, renderTime + extra.render);
      }
    });

    if (renderLabel) {
      renderLabel.textContent = `${Math.round(renderTime)}`;
    }
  };

  const applyProfile = (profileKey) => {
    const profile = profiles[profileKey];
    if (!profile) return;

    selects.forEach((select) => {
      if (profile[select.id] !== undefined) {
        select.value = String(profile[select.id]);
        select.dispatchEvent(new Event("change"));
      }
    });

    extras.forEach((checkbox) => {
      checkbox.checked = profile.extras.includes(checkbox.value);
    });

    if (budgetSlider) {
      budgetSlider.value = String(profile.budget);
      setBudgetDisplay(profile.budget);
    }

    updateSummary();
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((button) => {
        button.classList.toggle("active", button === tab);
        button.setAttribute("aria-selected", String(button === tab));
      });
      const profile = tab.dataset.profile;
      if (profile) {
        applyProfile(profile);
      }
    });
  });

  selects.forEach((select) => {
    select.addEventListener("change", updateSummary);
  });

  extras.forEach((checkbox) => {
    checkbox.addEventListener("change", updateSummary);
  });

  if (budgetSlider) {
    setBudgetDisplay(Number(budgetSlider.value));
    budgetSlider.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      setBudgetDisplay(value);
      updateSummary();
    });
  }

  document.querySelectorAll("[data-scroll]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const targetSelector = trigger.getAttribute("data-scroll");
      if (!targetSelector) return;
      const target = document.querySelector(targetSelector);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = contactForm.querySelector('button[type="submit"]');
      if (button) {
        const original = button.textContent;
        button.disabled = true;
        button.textContent = "Заявка отправлена";
        setTimeout(() => {
          button.disabled = false;
          button.textContent = original;
        }, 3200);
      }
      contactForm.reset();
      applyProfile(
        tabs.find((tab) => tab.classList.contains("active"))?.dataset.profile || "gaming"
      );
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("aos-animate");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
    }
  );

  document.querySelectorAll("[data-aos]").forEach((element) => observer.observe(element));

  applyProfile("gaming");
});
