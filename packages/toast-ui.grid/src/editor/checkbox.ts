import {
  CellEditor,
  CellEditorProps,
  GridRectForDropDownLayerPos,
  InstantlyAppliable,
  LayerPos,
  PortalEditingKeydown,
} from '@t/editor';
import { CellValue, ListItem } from '@t/store/data';
import { getListItems } from '../helper/editor';
import { cls, hasClass } from '../helper/dom';
import { getKeyStrokeString, isArrowKey } from '../helper/keyboard';
import { findIndex, isNil, pixelToNumber } from '../helper/common';
import { getContainerElement, setLayerPosition, setOpacity, moveLayer } from './dom';

const LAYER_CLASSNAME = cls('editor-checkbox-list-layer');
const LIST_ITEM_CLASSNAME = cls('editor-checkbox');
const HOVERED_LIST_ITEM_CLASSNAME = `${cls('editor-checkbox-hovered')} ${LIST_ITEM_CLASSNAME}`;
const UNCHECKED_RADIO_LABEL_CLASSNAME = cls('editor-label-icon-radio');
const CHECKED_RADIO_LABEL_CLASSNAME = cls('editor-label-icon-radio-checked');
const UNCHECKED_CHECKBOX_LABEL_CLASSNAME = cls('editor-label-icon-checkbox');
const CHECKED_CHECKBOX_LABEL_CLASSNAME = cls('editor-label-icon-checkbox-checked');

export class CheckboxEditor implements CellEditor, InstantlyAppliable {
  public el: HTMLElement;

  public isMounted = false;

  private layer: HTMLUListElement;

  private readonly inputType: 'checkbox' | 'radio';

  private hoveredItemId = '';

  private portalEditingKeydown: PortalEditingKeydown;

  private elementIds: string[] = [];

  private initLayerPos: LayerPos | null = null;

  // add by liq 新增的输入框
  private filterInput: HTMLInputElement | null = null;

  private filterable = false;

  instantApplyCallback: ((...args: any[]) => void) | null = null;

  public constructor(props: CellEditorProps) {
    const { columnInfo, width, formattedValue, portalEditingKeydown, instantApplyCallback } = props;
    const { type: inputType, instantApply, filterable } = columnInfo.editor?.options ?? {};
    const el = document.createElement('div');
    const value = String(isNil(props.value) ? '' : props.value);
    el.className = cls('layer-editing-inner');
    el.innerText = formattedValue;

    this.inputType = inputType;

    const listItems = getListItems(props);
    // modify by liq 调整到this.el初期化之后
    // const layer = this.createLayer(listItems, width);

    this.portalEditingKeydown = portalEditingKeydown;
    this.el = el;
    // modify by liq 位置调整
    this.filterable = filterable;
    const layer = this.createLayer(listItems, width);
    this.layer = layer;

    this.setValue(value);

    if (instantApply && inputType === 'radio') {
      this.instantApplyCallback = instantApplyCallback;
    }
  }

  private createLayer(listItems: ListItem[], width: number) {
    const layer = document.createElement('ul');
    layer.className = LAYER_CLASSNAME;
    layer.style.minWidth = `${width}px`;
    // To hide the initial layer which is having the position which is not calculated properly
    setOpacity(layer, 0);

    listItems.forEach(({ text, value }) => {
      // add by liq 添加if判断
      if (value) {
        const id = `checkbox-${value}`;
        const listItemEl = document.createElement('li');

        listItemEl.id = id;
        listItemEl.className = LIST_ITEM_CLASSNAME;
        listItemEl.appendChild(this.createCheckboxLabel(value, text));

        this.elementIds.push(id);

        layer.appendChild(listItemEl);
      } else {
        console.warn(`Item with text "${text}" has an invalid value: ${value}`);
      }
    });

    layer.addEventListener('change', this.onChange);
    layer.addEventListener('mouseover', this.onMouseover);
    layer.addEventListener('keydown', this.onKeydown);

    return layer;
  }

  // add by liq
  private onFilterInput = (event: Event) => {
    const value = (event.target as HTMLInputElement).value.toLowerCase(); // 获取输入值并转换为小写

    // 清空当前的列表项
    this.layer.querySelectorAll('li').forEach((item) => {
      const label = item.textContent?.toLowerCase() || '';
      if (label.includes(value)) {
        item.style.display = ''; // 显示匹配项
      } else {
        item.style.display = 'none'; // 隐藏不匹配项
      }
    });
  };

  private onFilterFocus = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.style.borderColor = '#485fc7'; // 设置聚焦时的边框颜色
    }
  };

  private onFilterBlur = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.style.borderColor = '#aaa'; // 恢复默认边框颜色
    }
  };

  private createCheckboxLabel(value: CellValue, text: string) {
    const input = document.createElement('input');
    const label = document.createElement('label');
    const span = document.createElement('span');

    label.className =
      this.inputType === 'radio'
        ? UNCHECKED_RADIO_LABEL_CLASSNAME
        : UNCHECKED_CHECKBOX_LABEL_CLASSNAME;

    input.type = this.inputType;
    input.name = 'checkbox';
    input.value = String(value);

    span.innerText = text;

    label.appendChild(input);
    label.appendChild(span);

    return label;
  }

  private getItemId(target: HTMLElement) {
    return target.id || target.parentElement!.id;
  }

  private onMouseover = (ev: MouseEvent) => {
    const targetId = this.getItemId(ev.target as HTMLElement);
    if (targetId && targetId !== this.hoveredItemId) {
      this.highlightItem(targetId);
    }
  };

  private onChange = (ev: Event) => {
    const value = (ev.target as HTMLInputElement).value;
    this.setLabelClass(value);

    // eslint-disable-next-line no-unused-expressions
    this.instantApplyCallback?.();
  };

  private onKeydown = (ev: KeyboardEvent) => {
    const keyName = getKeyStrokeString(ev);
    if (isArrowKey(keyName)) {
      ev.preventDefault();
      const elementIdx = findIndex((id) => id === this.hoveredItemId, this.elementIds);
      const totalCount = this.elementIds.length;
      const offset = totalCount + (keyName === 'down' || keyName === 'right' ? 1 : -1);
      const id = this.elementIds[(elementIdx + offset) % totalCount];

      this.highlightItem(id);
    } else {
      // except arrow key, pass the event to editing layer for using existing editing keyMap
      this.portalEditingKeydown(ev);
    }
  };

  private highlightItem(targetId: string) {
    // modify by liq
    // if (this.hoveredItemId) {
    //   this.layer.querySelector(`#${this.hoveredItemId}`)!.className = LIST_ITEM_CLASSNAME;
    // }

    // this.hoveredItemId = targetId;
    // const item = this.layer.querySelector(`#${targetId}`)!;
    // item.className = HOVERED_LIST_ITEM_CLASSNAME;
    // item.querySelector('input')!.focus();

    if (this.hoveredItemId) {
      const previousItem = this.layer.querySelector(`#${this.hoveredItemId}`);
      if (previousItem) {
        previousItem.className = LIST_ITEM_CLASSNAME;
      }
    }

    this.hoveredItemId = targetId;
    const item = this.layer.querySelector(`#${targetId}`);
    if (item) {
      item.className = HOVERED_LIST_ITEM_CLASSNAME;
      const checkboxInput = item.querySelector('input');
      if (checkboxInput) {
        checkboxInput.focus(); // 仅在存在时聚焦
      } else {
        console.warn(`Input not found in item with ID: ${targetId}`);
      }
    } else {
      console.warn(`No element found with ID: ${targetId}`);
    }
  }

  private setLabelClass(inputValue: CellValue) {
    const label = this.layer.querySelector(`#checkbox-${inputValue} label`) as HTMLLabelElement;
    if (this.inputType === 'checkbox') {
      // add by liq 添加if条件
      if (label) {
        label.className = hasClass(label, 'editor-label-icon-checkbox-checked')
          ? UNCHECKED_CHECKBOX_LABEL_CLASSNAME
          : CHECKED_CHECKBOX_LABEL_CLASSNAME;
      }
    } else {
      const checkedLabel = this.layer.querySelector(`.${CHECKED_RADIO_LABEL_CLASSNAME}`);
      if (checkedLabel) {
        checkedLabel.className = UNCHECKED_RADIO_LABEL_CLASSNAME;
      }
      // add by liq 添加if条件
      if (label) {
        label.className = CHECKED_RADIO_LABEL_CLASSNAME;
      }
    }
  }

  private getCheckedInput() {
    return (this.layer.querySelector('input:checked') ||
      this.layer.querySelector('input')) as HTMLInputElement;
  }

  public moveDropdownLayer(gridRect: GridRectForDropDownLayerPos) {
    if (this.initLayerPos) {
      moveLayer(this.layer, this.initLayerPos, gridRect);
    }
    // add by liq 移动layer后再次调整输入框位置
    if (this.filterable && this.filterInput) {
      // 设置 filterInput 的宽度和位置，需要判断是否显示了纵向滚动条
      let plusWidth = 2; // 2为左右边框
      if (this.layer.scrollHeight > this.layer.clientHeight) {
        plusWidth = plusWidth + 17; // 纵向滚动条宽度
      }
      this.filterInput.style.width = `${this.layer.clientWidth + plusWidth}px`;
      this.filterInput.style.top = `${pixelToNumber(this.layer.style.top) - 29}px`;
      this.filterInput.style.left = `${this.layer.style.left}`;
    }
  }

  public getElement() {
    return this.el;
  }

  private setValue(value: CellValue) {
    String(value)
      .split(',')
      .forEach((inputValue) => {
        const input = this.layer.querySelector(`input[value="${inputValue}"]`) as HTMLInputElement;
        if (input) {
          input.checked = true;
          this.setLabelClass(inputValue);
        }
      });
  }

  public getValue() {
    const checkedInputs = this.layer.querySelectorAll('input:checked');
    const checkedValues = [];
    for (let i = 0, len = checkedInputs.length; i < len; i += 1) {
      checkedValues.push((checkedInputs[i] as HTMLInputElement).value);
    }

    return checkedValues.join(',');
  }

  public mounted() {
    // To prevent wrong stacked z-index context, layer append to grid container
    getContainerElement(this.el).appendChild(this.layer);
    // @ts-ignore
    setLayerPosition(this.el, this.layer);

    // add by liq 创建过滤输入框
    if (this.filterable) {
      this.filterInput = document.createElement('input');
      this.filterInput.type = 'text';
      this.filterInput.placeholder = '输入关键字过滤...';
      // 设置样式
      this.filterInput.style.height = '30px'; // 设置高度
      this.filterInput.style.padding = '0 10px'; // 设置内边距
      this.filterInput.style.position = 'absolute'; // 使用绝对定位
      this.filterInput.style.top = '0'; // 固定在 layer 顶部
      this.filterInput.style.left = '0'; // 根据需要调整
      this.filterInput.style.width = '100%'; // 可以设置为100%以匹配父容器的宽度
      this.filterInput.style.zIndex = '1000'; // 确保输入框在顶部
      this.filterInput.style.border = 'solid 1px #aaa';
      this.filterInput.autofocus = true; // 设置自动聚焦
      this.filterInput.addEventListener('input', this.onFilterInput); // 添加输入事件
      this.filterInput.addEventListener('focus', this.onFilterFocus); // 添加光标事件
      this.filterInput.addEventListener('blur', this.onFilterBlur); // 添加失去光标事件
      // 将输入框添加到 el 元素中，而不是 layer
      getContainerElement(this.el).appendChild(this.filterInput); // 将输入框添加到父元素中
    }

    this.initLayerPos = {
      top: pixelToNumber(this.layer.style.top),
      left: pixelToNumber(this.layer.style.left),
    };

    const checkedInput = this.getCheckedInput();
    if (checkedInput) {
      this.highlightItem(`checkbox-${checkedInput.value}`);
    }

    this.isMounted = true;
    // To show the layer which has appropriate position
    setOpacity(this.layer, 1);

    // add by liq 初始化输入框
    if (this.filterable && this.filterInput) {
      // 设置 filterInput 的宽度和位置，需要判断是否显示了纵向滚动条
      let plusWidth = 2; // 2为左右边框
      if (this.layer.scrollHeight > this.layer.clientHeight) {
        plusWidth = plusWidth + 17; // 纵向滚动条宽度
      }
      this.filterInput.style.width = `${this.layer.clientWidth + plusWidth}px`;
      this.filterInput.style.top = `${pixelToNumber(this.layer.style.top) - 29}px`;
      this.filterInput.style.left = `${this.layer.style.left}`;
      this.filterInput.value = ''; // 确保不为 null
    }
  }

  public beforeDestroy() {
    this.layer.removeEventListener('change', this.onChange);
    this.layer.removeEventListener('mouseover', this.onMouseover);
    this.layer.removeEventListener('keydown', this.onKeydown);
    // add by liq 移除过滤输入框的事件监听
    if (this.filterable && this.filterInput) {
      this.filterInput.removeEventListener('input', this.onFilterInput);
      this.filterInput.removeEventListener('focus', this.onFilterFocus);
      this.filterInput.removeEventListener('blur', this.onFilterBlur);
      getContainerElement(this.el).removeChild(this.filterInput); // 从 layer 中移除 filterInput
      this.filterInput = null; // 将引用设置为 null
    }
    getContainerElement(this.el).removeChild(this.layer);
    this.initLayerPos = null;
    this.isMounted = false;
  }
}
