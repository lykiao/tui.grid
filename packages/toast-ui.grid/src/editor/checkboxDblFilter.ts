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

export class CheckboxDblFilterEditor implements CellEditor, InstantlyAppliable {
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

  // 下拉框
  private filterSelect: HTMLSelectElement | null = null;

  // 下拉框的过滤输入框
  private filterSelInput: HTMLInputElement | null = null;

  // 外部传入的选项
  private selectOptions: Array<{ value: string; label: string }> = [];

  // 外部传入的下拉placeholder
  private selectPlaceholder: string | null = null;

  // 左侧下拉选择值
  private filterSelectValue = '';

  // 右侧input框输入值
  private filterInputValue = '';

  // layer最大高度
  private maxLayerHeight = 0;

  // 下拉框filterSelect的size
  private optionSize = 0;

  instantApplyCallback: ((...args: any[]) => void) | null = null;

  public constructor(props: CellEditorProps) {
    const { columnInfo, width, formattedValue, portalEditingKeydown, instantApplyCallback } = props;
    const { type: inputType, instantApply, filterable, selectOptions, selectPlaceholder } =
      columnInfo.editor?.options ?? {};
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
    // 接收外部传入的选项
    this.selectOptions = selectOptions || [];
    this.selectPlaceholder = selectPlaceholder;
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

    listItems.forEach(({ text, value, extra }) => {
      // add by liq 添加if判断
      if (value) {
        const id = `checkbox-${value}`;
        const listItemEl = document.createElement('li');

        listItemEl.id = id;
        listItemEl.className = LIST_ITEM_CLASSNAME;
        listItemEl.appendChild(this.createCheckboxLabel(value, text));

        // 为 li 添加 extra 属性
        if (extra) {
          listItemEl.setAttribute('data-extra', extra); // 使用 data-extra 作为属性名
        } else {
          listItemEl.setAttribute('data-extra', 'empty'); // 或者设置为一个默认值
        }

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
  // 过滤下拉框选项
  private onFilterSelInputChange = (event: Event) => {
    const inputValue = (event.target as HTMLInputElement).value.toLowerCase();
    this.filterSelectOptions(inputValue);
    if (inputValue === '') {
      // 取消选择
      this.filterSelect!.value = '';
      this.filterSelectValue = '';
      this.doSearch();
    }
  };

  private onFilterSelInputClick = (event: Event) => {
    const inputValue = (event.target as HTMLInputElement).value.toLowerCase();
    this.filterSelectOptions(inputValue);
    if (this.filterSelect) {
      this.filterSelect.size = this.optionSize;
      if (this.filterSelect.style.display === 'none') {
        this.filterSelect.style.display = 'block';
      } else {
        this.filterSelect.style.display = 'none';
      }
    }
  };

  // 过滤选项
  private filterSelectOptions(inputValue: string) {
    const options = Array.from(this.filterSelect!.options);
    options.forEach((option) => {
      const isVisible = option.text.toLowerCase().includes(inputValue);
      option.style.display = isVisible ? 'block' : 'none'; // 仅显示匹配项
    });
  }

  private onFilterSelInputFocus = (event: Event) => {
    const selInput = event.target as HTMLInputElement;
    // this.filterSelect!.style.borderColor = '#485fc7'; // 设置聚焦时的边框颜色
    this.filterSelect!.style.zIndex = '1500'; // 防止右边线被覆盖
    if (selInput) {
      selInput.style.zIndex = '2000'; // 防止右边线被覆盖
      selInput.style.borderColor = '#485fc7'; // 设置聚焦时的边框颜色
    }
  };

  private onFilterSelInputBlur = (event: Event) => {
    const selInput = event.target as HTMLInputElement;
    // this.filterSelect!.style.borderColor = '#aaa'; // 恢复默认边框颜色
    this.filterSelect!.style.zIndex = '1000'; // 恢复zIndex
    if (selInput) {
      selInput.style.zIndex = '1000'; // 恢复zIndex
      selInput.style.borderColor = '#aaa'; // 恢复默认边框颜色
    }
  };

  private onFilterSelectFocus = (event: Event) => {
    const select = event.target as HTMLInputElement;
    if (select) {
      select.style.borderColor = '#485fc7'; // 设置聚焦时的边框颜色
      select.style.zIndex = '1500'; // 防止右边线被覆盖
    }
    this.filterSelInput!.style.zIndex = '2000'; // 防止右边线被覆盖
  };

  private onFilterSelectBlur = (event: Event) => {
    const select = event.target as HTMLInputElement;
    if (select) {
      select.style.borderColor = '#aaa'; // 恢复默认边框颜色
      select.style.zIndex = '1000'; // 恢复zIndex
    }
    this.filterSelInput!.style.zIndex = '1000'; // 恢复zIndex
  };

  // 处理下拉框变化事件
  private onFilterSelectChange = (event: Event) => {
    this.filterSelectValue = (event.target as HTMLSelectElement).value;
    console.log('Selected value:', this.filterSelectValue);
    // 将选择的文本信息显示到左侧input框中
    const selectedOption = this.filterSelect!.options[this.filterSelect!.selectedIndex];
    const selectedText = selectedOption ? selectedOption.text : ''; // 确保有文本
    this.filterSelInput!.value = selectedText; // 将选中的文本设置到 filterSelInput
    // 执行查询
    this.doSearch();
  };

  // 处理下拉框变化事件
  private onFilterSelectMouseup = (event: Event) => {
    const target = event.target as HTMLElement;
    console.log('onFilterSelectMouseup:', target);
    // 检查目标是否是 option 元素
    setTimeout(() => {
      if (target.tagName === 'OPTION') {
        this.filterSelect!.style.display = 'none';
      }
    }, 10);
  };

  private onFilterInput = (event: Event) => {
    this.filterInputValue = (event.target as HTMLInputElement).value.toLowerCase(); // 获取输入值并转换为小写
    this.doSearch();
  };

  private doSearch() {
    // 清空当前的列表项
    this.layer.querySelectorAll('li').forEach((item) => {
      const label = item.textContent?.toLowerCase() || '';
      // const inputElement = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
      // const value = inputElement ? inputElement.value : '';
      const extra = item.getAttribute('data-extra');
      if (
        label.includes(this.filterInputValue) &&
        ((this.filterSelectValue !== '' && extra === this.filterSelectValue) ||
          this.filterSelectValue === '')
      ) {
        item.style.display = ''; // 显示匹配项
      } else {
        item.style.display = 'none'; // 隐藏不匹配项
      }
    });
    // 更新宽度
    this.updateEverySize();
  }

  private onFilterFocus = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.style.borderColor = '#485fc7'; // 设置聚焦时的边框颜色
      input.style.zIndex = '2000'; // 防止左边线被覆盖
    }
    setTimeout(() => {
      // 隐藏下拉
      if (this.filterSelect) {
        this.filterSelect.style.display = 'none';
      }
      // 如果无选择项，则清空selInput
      if (this.filterSelect!.value === '') {
        this.filterSelInput!.value = '';
      }
    }, 10);
  };

  private onFilterBlur = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.style.borderColor = '#aaa'; // 恢复默认边框颜色
      input.style.zIndex = '1000'; // 恢复zIndex
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

  private updateEverySize() {
    // 设置 filterInput 的宽度和位置，需要判断是否显示了纵向滚动条
    let plusWidth = 2; // 2为左右边框
    if (this.layer.scrollHeight > this.layer.clientHeight) {
      plusWidth = plusWidth + 17; // 纵向滚动条宽度
    }
    const halfWidth = (this.layer.clientWidth + plusWidth) / 2;
    if (this.filterSelect) {
      // 左侧下拉
      this.filterSelect.style.width = `${halfWidth}px`;
      // this.filterSelect.style.top = `${pixelToNumber(this.layer.style.top) - 29}px`;
      this.filterSelect.style.top = `${pixelToNumber(this.layer.style.top)}px`;
      this.filterSelect.style.left = `${this.layer.style.left}`;
    }
    if (this.filterSelInput) {
      // 左侧下拉的input，width减掉下拉按钮宽度15px，top加上拉边线1px，left加左边线1px
      // this.filterSelInput.style.width = `${halfWidth - 15}px`;
      this.filterSelInput.style.width = `${halfWidth + 2}px`;
      this.filterSelInput.style.top = `${pixelToNumber(this.layer.style.top) - 29}px`;
      this.filterSelInput.style.left = `${pixelToNumber(this.layer.style.left)}px`;
    }
    if (this.filterInput) {
      // 右侧input框，width减1，left加1
      this.filterInput.style.width = `${halfWidth - 1}px`;
      this.filterInput.style.top = `${pixelToNumber(this.layer.style.top) - 29}px`;
      this.filterInput.style.left = `${pixelToNumber(this.layer.style.left) + halfWidth + 1}px`;
    }
  }

  public moveDropdownLayer(gridRect: GridRectForDropDownLayerPos) {
    if (this.initLayerPos) {
      moveLayer(this.layer, this.initLayerPos, gridRect);
    }
    // add by liq 移动layer后再次调整输入框位置
    if (this.filterable) {
      this.updateEverySize();
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

    // add by liq 创建过滤组件
    if (this.filterable) {
      // 创建左侧下拉框
      this.filterSelect = document.createElement('select');
      this.filterSelect.id = 'filterSelectElement';
      this.filterSelect.size = 10;
      this.filterSelect.style.display = 'none';
      this.filterSelect.style.height = 'unset';
      this.filterSelect.style.marginRight = '0'; // 下拉框和输入框的间距
      this.filterSelect.style.position = 'absolute'; // 绝对定位
      this.filterSelect.style.top = '0'; // 固定在顶部
      this.filterSelect.style.left = '0'; // 根据需要调整
      this.filterSelect.style.zIndex = '1000'; // 确保下拉框在顶部
      this.filterSelect.style.border = 'solid 1px #aaa';
      // 添加外部传入的选项
      this.selectOptions.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        this.filterSelect!.appendChild(opt);
      });
      // 监听下拉框变化事件
      this.filterSelect.addEventListener('focus', this.onFilterSelectFocus);
      this.filterSelect.addEventListener('blur', this.onFilterSelectBlur);
      this.filterSelect.addEventListener('change', this.onFilterSelectChange);
      this.filterSelect.addEventListener('mouseup', this.onFilterSelectMouseup);
      getContainerElement(this.el).appendChild(this.filterSelect);
      // 创建下拉框的过滤输入框
      this.filterSelInput = document.createElement('input');
      this.filterSelect.id = 'filterSelInputElement';
      this.filterSelInput.type = 'text';
      this.filterSelInput.placeholder = this.selectPlaceholder
        ? this.selectPlaceholder
        : '过滤选项...';
      // height减掉下拉上下边线2px
      this.filterSelInput.style.height = '30px';
      this.filterSelInput.style.padding = '0 10px'; // 设置内边距
      this.filterSelInput.style.position = 'absolute';
      this.filterSelInput.style.top = '0'; // 固定在顶部
      this.filterSelInput.style.left = '0'; // 下拉框左侧
      this.filterSelInput.style.zIndex = '1000';
      this.filterSelInput.style.marginRight = '0'; // 输入框和下拉框的间距
      this.filterSelInput.style.border = 'solid 1px #aaa';
      // 监听过滤输入框事件
      this.filterSelInput.addEventListener('focus', this.onFilterSelInputFocus);
      this.filterSelInput.addEventListener('blur', this.onFilterSelInputBlur);
      this.filterSelInput.addEventListener('input', this.onFilterSelInputChange);
      this.filterSelInput.addEventListener('click', this.onFilterSelInputClick);
      getContainerElement(this.el).appendChild(this.filterSelInput);

      // 创建右侧input框
      this.filterInput = document.createElement('input');
      this.filterInput.type = 'text';
      this.filterInput.placeholder = '输入关键字过滤...';
      // 设置样式
      this.filterInput.style.height = '30px'; // 设置高度
      this.filterInput.style.padding = '0 10px'; // 设置内边距
      this.filterInput.style.position = 'absolute'; // 使用绝对定位
      this.filterInput.style.top = '0'; // 固定在 layer 顶部
      this.filterInput.style.left = '0'; // 根据需要调整
      this.filterInput.style.width = '50%'; // 可以设置为100%以匹配父容器的宽度
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

    // 防止一开始无纵向滚动条，过滤后有纵向滚动条，导致显示内容折行（和checkbox不在同一行）
    const orgLayerWidth = window.getComputedStyle(this.layer).width;
    this.layer.style.width = `${pixelToNumber(orgLayerWidth) + 2 + 17}px`;
    this.layer.style.left = `${pixelToNumber(this.layer.style.left) - 17}px`;
    this.layer.style.minHeight = '40px';
    // 编辑时文字不可见（否则会窜到别的cell，有重影）
    const layerEditingInner = document.querySelector(
      '.tui-grid-layer-editing-inner'
    ) as HTMLElement;
    if (layerEditingInner) {
      layerEditingInner.style.color = 'transparent';
    }

    // To show the layer which has appropriate position
    setOpacity(this.layer, 1);

    // 记录最大高度，用于设置filterSelect的size
    this.maxLayerHeight = this.layer.clientHeight;
    const count = Math.floor(this.maxLayerHeight / 18); // 18px为filterSelect中每个option的高度
    this.optionSize = this.selectOptions.length > count ? count : this.selectOptions.length;

    // add by liq 初始化输入框
    if (this.filterable) {
      this.updateEverySize();
      if (this.filterInput) {
        this.filterInput.value = ''; // 确保不为 null
      }
    }
  }

  public beforeDestroy() {
    this.layer.removeEventListener('change', this.onChange);
    this.layer.removeEventListener('mouseover', this.onMouseover);
    this.layer.removeEventListener('keydown', this.onKeydown);
    // add by liq 移除过滤下拉及输入框的事件监听
    if (this.filterable) {
      if (this.filterSelect) {
        // 左侧下拉
        this.filterSelect.removeEventListener('focus', this.onFilterSelectFocus);
        this.filterSelect.removeEventListener('blur', this.onFilterSelectBlur);
        this.filterSelect.removeEventListener('change', this.onFilterSelectChange);
        this.filterSelect.removeEventListener('mouseup', this.onFilterSelectMouseup);
        getContainerElement(this.el).removeChild(this.filterSelect); // 从 layer 中移除 filterSelect
        this.filterSelect = null; // 将引用设置为 null
      }
      if (this.filterSelInput) {
        // 左侧下拉的input
        this.filterSelInput.removeEventListener('focus', this.onFilterSelInputFocus);
        this.filterSelInput.removeEventListener('blur', this.onFilterSelInputBlur);
        this.filterSelInput.removeEventListener('input', this.onFilterSelInputChange);
        this.filterSelInput.removeEventListener('click', this.onFilterSelInputClick);
        getContainerElement(this.el).removeChild(this.filterSelInput); // 从 layer 中移除 filterSelInput
        this.filterSelInput = null; // 将引用设置为 null
      }
      if (this.filterInput) {
        // 右侧input框
        this.filterInput.removeEventListener('input', this.onFilterInput);
        this.filterInput.removeEventListener('focus', this.onFilterFocus);
        this.filterInput.removeEventListener('blur', this.onFilterBlur);
        getContainerElement(this.el).removeChild(this.filterInput); // 从 layer 中移除 filterInput
        this.filterInput = null; // 将引用设置为 null
      }
    }
    getContainerElement(this.el).removeChild(this.layer);
    this.initLayerPos = null;
    this.isMounted = false;
  }
}
