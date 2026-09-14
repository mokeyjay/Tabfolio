import { Component, type ErrorInfo, type ReactNode } from 'react'
import { messages } from '../i18n'

/**
 * 渲染期兜底。
 *
 * `boot()` 已经接住了启动阶段的异常，但书签树是用户数据，形态穷举不完
 * —— 渲染中途抛错的话整页就是一片空白，用户连「这是扩展坏了」都看不出来。
 * 这里退回和启动失败同一块面板，至少能看到原因、知道去哪儿重载。
 *
 * 只能写成 class：React 到今天也没给函数组件对应的钩子。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('签页集渲染失败', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return <div className="bnt-boot">{messages().boot.failed(error.message)}</div>
  }
}
