/*
 * Tencent is pleased to support the open source community by making
 * 蓝鲸智云PaaS平台社区版 (BlueKing PaaS Community Edition) available.
 *
 * Copyright (C) 2021 THL A29 Limited, a Tencent company.  All rights reserved.
 *
 * 蓝鲸智云PaaS平台社区版 (BlueKing PaaS Community Edition) is licensed under the MIT License.
 *
 * License for 蓝鲸智云PaaS平台社区版 (BlueKing PaaS Community Edition):
 *
 * ---------------------------------------------------
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of
 * the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
 * THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
*/
import { computed, defineComponent, h, onMounted, onUpdated, reactive, ref, SetupContext, watch } from 'vue';

import { DownShape, Folder, FolderShapeOpen, RightShape, Spinner, TextFile } from '@bkui-vue/icon/';
import { resolveClassName } from '@bkui-vue/shared';
import VirtualRender from '@bkui-vue/virtual-render';

import { treeProps, TreePropTypes as defineTypes } from './props';
import {
  assignTreeNode,
  getFlatdata,
  getLabel,
  getNodeItemClass,
  getNodeItemStyle,
  getNodeRowClass,
  getTreeStyle,
  updateTreeNode,
} from './util';

export type TreePropTypes = defineTypes;

export default defineComponent({
  name: 'Tree',
  props: treeProps,
  emits: ['check'],

  setup(props: TreePropTypes, ctx: SetupContext) {
    const formatData = getFlatdata(props);
    const checkedNodes = [];
    /**
     * 扁平化数据
     * schema: 需要展示连线时，用于计算连线高度
     */
    const flatData = reactive({
      data: formatData[0] as Array<any>,
      schema: formatData[1],
      levelLineSchema: {},
    });

    /**
     * 监听组件配置Data改变
     */
    watch(() => [props.data], (newData) => {
      const formatData = getFlatdata(props, newData, schemaValues.value);
      flatData.data = formatData[0] as Array<any>;
      flatData.schema = formatData[1] as any;
    }, {
      deep: true,
    });

    const schemaValues = computed(() => Array.from(flatData.schema.values()));

    /**
     * 获取Schema中指定的对象值
     * @param key
     * @returns
     */
    const getSchemaVal = (key: string) => ((flatData.schema as Map<string, any>).get(key));

    /**
     * 获取节点属性
     * @param node 当前节点
     * @param attr 节点属性
     * @returns
     */
    const getNodeAttr = (node: any, attr: string) => getSchemaVal(node.__uuid)?.[attr];

    /**
     * 设置节点属性
     * @param node 指定节点
     * @param attr 节点属性
     * @param val 属性值
     * @returns
     */
    const setNodeAttr = (node: any, attr: string, val: any) => (flatData.schema as Map<string, any>).set(node.__uuid, {
      ...getSchemaVal(node.__uuid),
      [attr]: val,
    });

    const getNodePath = (node: any) => getNodeAttr(node, '__path');
    const isRootNode = (node: any) => getNodeAttr(node, '__isRoot');
    const isNodeOpened = (node: any) => getNodeAttr(node, '__isOpen');
    const hasChildNode = (node: any) => getNodeAttr(node, '__hasChild');

    // 计算当前需要渲染的节点信息
    const renderData = computed(() => flatData.data
      .filter(item => checkNodeIsOpen(item)));

    /**
     * 判定指定节点是否为展开状态
     * @param item 节点或者节点 UUID
     * @returns
     */
    const isItemOpen = (item: any) => {
      if (typeof item === 'object') {
        return isNodeOpened(item);
      }

      if (typeof item === 'string') {
        return getSchemaVal(item)?.__isOpen;
      }

      return false;
    };


    /**
     * 根据当前节点状态获取节点类型Icon
     * @param item
     * @returns
     */
    const getRootIcon = (item: any) => (isItemOpen(item)
      ? <FolderShapeOpen class={ resolveClassName('tree-icon') } />
      : <Folder class={ resolveClassName('tree-icon') } />);


    /**
     * 渲染动态设置的节点样式
     * @param val
     * @returns
     */
    const renderPrefixVal = (val: string | { node: string, className: string, text: string, style: any } | any) => {
      if (typeof val === 'string') {
        return val;
      }

      if (typeof val === 'object' && val !== null) {
        if (val.__v_isVNode) {
          return val;
        }
        const { node, className, text, style } = val;
        return h(node, { class: className, style }, text);
      }

      return null;
    };

    /**
     * 根据节点状态获取节点操作Icon
     * @param item
     * @returns
     */
    const getActionIcon = (item: any) => {
      let prefixFnVal = null;

      if (typeof props.prefixIcon === 'function') {
        prefixFnVal = props.prefixIcon(isRootNode(item), hasChildNode(item) || item.async, isItemOpen(item), 'action', item);
        if (prefixFnVal !== 'default') {
          return renderPrefixVal(prefixFnVal);
        }
      }

      if (prefixFnVal === 'default' || (typeof props.prefixIcon === 'boolean' && props.prefixIcon)) {
        if (hasChildNode(item) || item.async) {
          return isItemOpen(item) ? <DownShape /> : <RightShape />;
        }
      }

      return null;
    };

    /**
     * 获取节点类型Icon
     * @param item
     * @returns
     */
    const getNodePrefixIcon = (item: any) => {
      let prefixFnVal = null;

      if (typeof props.prefixIcon === 'function') {
        prefixFnVal = props.prefixIcon(isRootNode(item), hasChildNode(item) || item.async, isItemOpen(item), 'node_type', item);

        if (prefixFnVal !== 'default') {
          return renderPrefixVal(prefixFnVal);
        }
      }

      if (prefixFnVal === 'default' || (typeof props.prefixIcon === 'boolean' && props.prefixIcon)) {
        return isRootNode(item) || hasChildNode(item) ? getRootIcon(item) : <TextFile class={ resolveClassName('tree-icon') } />;
      }

      return null;
    };

    const getLoadingIcon = (item: any) => (item.loading ? <Spinner></Spinner> : '');

    /**
     * 设置指定节点是否展开
     * @param item
     */
    const setNodeOpened = (item: any) => {
      const newVal = !isItemOpen(item);
      setNodeAttr(item, '__isOpen', newVal);

      /**
       * 在收起节点时需要重置当前节点的所有叶子节点状态为 __isOpen = false
       * 如果是需要点击当前节点展开所有叶子节点此处也可以打开
       */
      if (newVal) {
        return;
      }

      renderData.value.filter(node => String.prototype.startsWith.call(getNodePath(node), getNodePath(item)))
        .forEach(filterNode => setNodeAttr(filterNode, '__isOpen', newVal));
    };

    /**
     * 处理异步加载节点数据返回结果
     * @param resp 异步请求返回结果
     * @param item 当前节点
     */
    const setNodeRemoteLoad = (resp: any, item: any) => {
      if (typeof resp === 'object' && resp !== null) {
        setNodeAttr(item, '__isOpen', true);
        const nodeValue = Array.isArray(resp) ? resp : [resp];
        updateTreeNode(getNodePath(item), props.data, props.children, props.children, nodeValue);
      }
    };

    /**
     * 节点点击
     * @param item
     */
    const hanldeTreeNodeClick = (item: any) => {
      /** 如果是异步请求加载 */
      if (item.async) {
        const { callback = null, cache = true } = props.async || {};
        if (typeof callback === 'function' && !item.cached) {
          Object.assign(item, { loading: true });
          callback(item, (resp: any) => setNodeRemoteLoad(resp, item))
            .then((resp: any) => setNodeRemoteLoad(resp, item))
            .catch((err: any) => console.error('load remote data error:', err))
            .finally(() => {
              assignTreeNode(getNodePath(item), props.data, props.children, {
                loading: false,
                ...(cache ? { cached: true } : {}),
              });
            });
        } else {
          console.error('async need to set prop: asyncLoad with function wich will return promise object');
        }
      }

      if (hasChildNode(item)) {
        setNodeOpened(item);
      }
    };

    const handleNodeActionClick = (node: any) => {
      hanldeTreeNodeClick(node);
    };

    const handleNodeContentClick = (item: any) => {
      if (!checkedNodes.includes(item.__uuid)) {
        checkedNodes.forEach((__uuid: string) => setNodeAttr({ __uuid }, '__checked', false));
        checkedNodes.length = 0;
        setNodeAttr(item, '__checked', true);
        checkedNodes.push(item.__uuid);
        if (!isNodeOpened(item)) {
          hanldeTreeNodeClick(item);
        }

        ctx.emit('check', item, getSchemaVal(item.__uuid));
      }
    };

    /**
     * 过滤当前状态为Open的节点
     * 页面展示只会展示Open的节点
     * @param item
     * @returns
     */
    const checkNodeIsOpen = (node: any) => isRootNode(node) || isItemOpen(node) || isItemOpen(getNodeAttr(node, '__parentId'));

    /**
     * 用于判定当前节点需要展示的连线
     * 当前指定的depth需不需要展示连线
     * @param depth 当前需要判定的depth
     * @param node 当前节点
     * @returns
     */
    const filterNextNode = (depth: number, node: any) => {
      if (isRootNode(node)) {
        return false;
      }

      const nodepath = getNodePath(node);
      const paths = `${nodepath}`.split('-').slice(0, depth + 1);
      const currentPath = paths.join('-');

      // 如果是判定当前节点，则必须要有一条线
      if (currentPath === nodepath) {
        return true;
      }

      const lastLevel = paths.pop();
      const nextLevel = parseInt(lastLevel, 10);
      paths.push(`${nextLevel + 1}`);
      const nextNodePath = paths.join('-');
      return schemaValues.value.some((val: any) => val.__path === nextNodePath);
    };

    const getVirtualLines = (node: any) => {
      if (!props.levelLine) {
        return null;
      }

      const getNodeLineStyle = (dpth: number) => ({
        '--depth': dpth,
      });

      const maxDeep = getNodeAttr(node, '__depth') + 1;
      return new Array(maxDeep).fill('')
        .map((_, index: number) => index)
        .filter((depth: number) => filterNextNode(depth, node))
        .filter((depth: number) => depth > 0)
      // @ts-ignore:next-line
        .map((index: number) => <span class="node-virtual-line" style={ getNodeLineStyle(maxDeep - index) }></span>);
    };

    const root = ref();
    const setNodeTextStyle = () => {
      if (root.value?.$el) {
        const selector = `.${resolveClassName('tree-node')}`;
        const ctxSelector = `.${resolveClassName('node-content')}`;
        Array.prototype.forEach.call(root.value.$el.querySelectorAll(selector), (nodeEl: HTMLElement) => {
          const txtSpans = nodeEl.querySelectorAll(`${ctxSelector} span`);
          const lastSpan = Array.prototype.slice.call(txtSpans, -1)[0];
          if (lastSpan) {
            const maxWidth = nodeEl.offsetWidth - lastSpan.offsetLeft;
            (lastSpan as HTMLElement).style.setProperty('max-width', `${maxWidth}px`);
          }
        });
      }
    };
    onMounted(() => {
      setNodeTextStyle();
    });

    onUpdated(() => {
      setNodeTextStyle();
    });

    return {
      renderData,
      flatData,
      root,
      hanldeTreeNodeClick,
      handleNodeContentClick,
      handleNodeActionClick,
      getActionIcon,
      getRootIcon,
      getVirtualLines,
      getNodePrefixIcon,
      getLoadingIcon,
    };
  },

  render() {
    const props = this.$props;
    const renderTreeNode = (item: any) => <div class={ getNodeRowClass(item, this.flatData.schema) }>
      <div class={getNodeItemClass(item, this.flatData.schema, props)}
        style={getNodeItemStyle(item, props, this.flatData)}>
        <span class={ resolveClassName('node-action') } onClick={() => this.handleNodeActionClick(item)}>{ this.getActionIcon(item) }</span>
        <span class={ resolveClassName('node-content') } onClick={() => this.handleNodeContentClick(item)}>
          {
            [
              this.getNodePrefixIcon(item),
              this.getLoadingIcon(item),
            ]
          }
          <span class={ resolveClassName('node-text') }>{getLabel(item, props)}</span>
        </span>
        {
          this.getVirtualLines(item)
        }
      </div>
    </div>;

    return <VirtualRender class={ resolveClassName('tree') }
    style={getTreeStyle(null, props)}
    list={this.renderData}
    lineHeight={props.lineHeight}
    enabled={props.virtualRender}
    contentClassName={ resolveClassName('container') }
    throttleDelay={0}
    ref='root'>
    {
      {
        default: (scoped: any) => (scoped.data || []).map(renderTreeNode),
      }
    }
  </VirtualRender>;
  },
});
