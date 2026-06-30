// ===== src/renderer/roguelike/ui/CharmPicker.ts =====
// Charm picker panel with slot respect, rerolls, and synergy hints.

import { DraggablePanel } from '../../ui/DraggablePanel';
import { SceneUI } from '../../ui/SceneUI';
import { GameStateManager } from '../../core/GameStateManager';
import { ALL_CHARMS } from '../charm-data';
import { d, tooltip, CARD_STYLE, toast } from './run-ui-helpers';
import { i18n } from '../../i18n/I18n';
import { ModifierRarity } from '../../../shared/enums';
import { THEME } from '../../ui/theme';
import type { Modifier } from '../../../shared/types';

export interface CharmPickerCallbacks {
  onConfirm: (charms: Modifier[]) => void;
  onCancel: () => void;
}

export class CharmPicker {
  private gsm: GameStateManager;
  private sceneUI: SceneUI;
  private activePanel: DraggablePanel | null = null;

  constructor(gsm: GameStateManager, sceneUI: SceneUI) {
    this.gsm = gsm;
    this.sceneUI = sceneUI;
  }

  show(callbacks: CharmPickerCallbacks): void {
    const maxSlots = this.gsm.campManager.getMeta().charmSlots;
    const panel = new DraggablePanel(i18n.t('camp.chooseCharms', { '0': maxSlots }), 360);
    panel.el.id = 'charm-picker';
    panel.setPosition(window.innerWidth / 2 - 180, 40);
    const body = panel.getBody();
    body.append(
      d(
        'color: ${THEME.text.secondary}; font-size: 9px; text-align: center; margin-bottom: 8px;',
        '✅ 已选 · 🟡 共鸣 · 悬停查看详情',
      ),
    );

    let rerolls = this.gsm.campManager.getLevel('charm_rerolls');
    const picked: Modifier[] = [];
    const pool = [...ALL_CHARMS].sort(() => Math.random() - 0.5).slice(0, 8);

    const confirm = d(
      `
      margin-top: 10px; padding: 8px 0; text-align: center;
      background: rgba(68,221,136,0.18); border: 1px solid rgba(68,221,136,0.4);
      color: ${THEME.accent.greenLight}; font-size: 11px; font-weight: bold; cursor: pointer; border-radius: ${THEME.radius.lg};
      opacity: 0.35; transition: opacity 0.15s, background 0.15s, box-shadow 0.15s;
    `,
      i18n.t('camp.embark', { '0': '0', '1': String(maxSlots) }),
    );
    confirm.id = 'btn-embark';
    confirm.addEventListener('mouseenter', () => {
      if (picked.length === maxSlots) {
        confirm.style.background = 'rgba(68,221,136,0.32)';
        confirm.style.boxShadow = '0 0 18px rgba(68,221,136,0.3)';
      }
    });
    confirm.addEventListener('mouseleave', () => {
      confirm.style.background = 'rgba(68,221,136,0.18)';
      confirm.style.boxShadow = 'none';
    });
    const updateConfirm = () => {
      confirm.textContent = i18n.t('camp.embark', {
        '0': String(picked.length),
        '1': String(maxSlots),
      });
      confirm.style.opacity = picked.length === maxSlots ? '1' : '0.35';
    };

    const cardContainer = d('display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;', '');
    body.appendChild(cardContainer);

    const rarityColor = (r: ModifierRarity) => {
      switch (r) {
        case ModifierRarity.Rare:
          return THEME.accent.amber;
        case ModifierRarity.Uncommon:
          return THEME.accent.blue;
        case ModifierRarity.Cursed:
          return THEME.accent.red;
        default:
          return '#a1a1aa';
      }
    };
    const rarityLabel = (r: ModifierRarity) => {
      switch (r) {
        case ModifierRarity.Rare:
          return '稀有';
        case ModifierRarity.Uncommon:
          return '优秀';
        case ModifierRarity.Cursed:
          return '诅咒';
        default:
          return '普通';
      }
    };

    const renderCards = () => {
      cardContainer.innerHTML = '';
      const pickedTags = new Set<string>();
      picked.forEach((c) => c.tags.forEach((t: string) => pickedTags.add(t)));

      pool.forEach((charm) => {
        const effects = charm.effects
          .map((e) => {
            if (e.type === 'stat_mult') return `×${e.multiplier} ${e.stat}`;
            if (e.type === 'stat_add') return `${e.value > 0 ? '+' : ''}${e.value} ${e.stat}`;
            return e.type;
          })
          .join(', ');
        const ci18n = i18n.charm(charm.id);
        const sel = picked.includes(charm);

        const sharedTags = charm.tags.filter((t: string) => pickedTags.has(t));
        const hasSynergyHint = !sel && sharedTags.length > 0 && picked.length > 0;

        const card = d(
          CARD_STYLE +
            `
          background: ${sel ? 'rgba(68,221,136,0.18)' : 'rgba(255,255,255,0.06)'};
          border-color: ${sel ? 'rgba(68,221,136,0.85)' : 'rgba(255,255,255,0.12)'};
          ${sel ? 'box-shadow: 0 0 14px rgba(68,221,136,0.35);' : ''}
        `,
          `
          <div style="position:relative;width:100%;">
            ${sel ? `<div style="position:absolute;top:-8px;right:-3px;width:16px;height:16px;background:${THEME.accent.greenDark};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);">✓</div>` : ''}
            <div style="font-size:20px;margin-bottom:2px;">${charm.icon}</div>
          </div>
          <div style="font-weight:bold;margin:1px 0;font-size:11px;color:#fff;">${ci18n.name}</div>
          <div style="color:#9ca3af;line-height:1.25;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:9px;">${ci18n.desc}</div>
          <div style="height:14px;margin-top:auto;display:flex;align-items:center;justify-content:center;gap:3px;width:100%;">
            ${
              hasSynergyHint
                ? `<span style="color:${THEME.accent.amber};font-size:8px;font-weight:bold;">🔗 ${sharedTags.map((t: string) => '#' + t).join(' ')}</span>`
                : `<span style="color:${rarityColor(charm.rarity)};font-size:8px;font-weight:600;">${rarityLabel(charm.rarity)}</span>`
            }
          </div>
        `,
        );
        card.addEventListener('click', () => {
          const idx = picked.indexOf(charm);
          if (idx >= 0) picked.splice(idx, 1);
          else if (picked.length < maxSlots) picked.push(charm);
          updateConfirm();
          renderCards();
        });
        card.addEventListener('mouseenter', () => {
          card.style.transform = 'translateY(-2px)';
          if (!sel)
            card.style.background = hasSynergyHint
              ? 'rgba(251,191,36,0.10)'
              : 'rgba(255,255,255,0.12)';
          const tipHtml = `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
              <span style="font-size:18px;">${charm.icon}</span>
              <span style="font-weight:bold;color:#fff;font-size:11px;">${ci18n.name}</span>
              <span style="color:${rarityColor(charm.rarity)};font-size:9px;margin-left:auto;font-weight:600;">${rarityLabel(charm.rarity)}</span>
            </div>
            <div style="color:#cbd5e1;margin-bottom:6px;">${ci18n.desc}</div>
            <div style="color:#94a3b8;font-size:9px;margin-bottom:4px;">效果：${effects || '无'}</div>
            <div style="color:#64748b;font-size:8px;">标签：${charm.tags.map((t: string) => '#' + t).join(' ')}</div>
            ${hasSynergyHint ? `<div style="color:#fbbf24;font-size:9px;margin-top:5px;font-weight:600;">共鸣：${sharedTags.map((t: string) => '#' + t).join(' ')}</div>` : ''}
          `;
          tooltip.show(tipHtml, card);
        });
        card.addEventListener('mouseleave', () => {
          card.style.transform = 'translateY(0)';
          if (!sel) card.style.background = 'rgba(255,255,255,0.06)';
          tooltip.hide();
        });
        cardContainer.appendChild(card);
      });
    };
    renderCards();

    if (rerolls > 0) {
      const reroll = d(
        `
        text-align: center; padding: 5px; margin-top: 6px;
        color: rgba(255,255,255,0.55); font-size: 9px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.12); border-radius: 4px;
        transition: background 0.15s, color 0.15s;
      `,
        i18n.t('spec.reroll', { '0': String(rerolls) }),
      );
      reroll.addEventListener('mouseenter', () => {
        reroll.style.background = 'rgba(255,255,255,0.08)';
        reroll.style.color = '#e2e8f0';
      });
      reroll.addEventListener('mouseleave', () => {
        reroll.style.background = 'transparent';
        reroll.style.color = 'rgba(255,255,255,0.55)';
      });
      reroll.addEventListener('click', () => {
        if (rerolls <= 0) return;
        rerolls--;
        reroll.textContent = i18n.t('spec.reroll', { '0': String(rerolls) });
        if (rerolls === 0) reroll.style.opacity = '0.3';
        pool.length = 0;
        pool.push(...[...ALL_CHARMS].sort(() => Math.random() - 0.5).slice(0, 8));
        picked.length = 0;
        updateConfirm();
        renderCards();
      });
      body.appendChild(reroll);
    }

    confirm.addEventListener('click', () => {
      if (picked.length < maxSlots) {
        toast(i18n.t('notify.pickCharms', { '0': maxSlots - picked.length }));
        return;
      }
      if (picked.length === maxSlots) {
        tooltip.destroy();
        panel.remove();
        this.sceneUI.hideBackdrop();
        callbacks.onConfirm(picked);
      }
    });
    body.appendChild(confirm);

    panel.getCloseBtn().addEventListener('click', () => {
      tooltip.destroy();
      panel.remove();
      callbacks.onCancel();
    });
    document.body.appendChild(panel.el);
    this.activePanel = panel;
  }

  close(): void {
    if (this.activePanel) {
      tooltip.destroy();
      this.activePanel.remove();
      this.activePanel = null;
    }
  }

  dispose(): void {
    this.close();
  }
}
