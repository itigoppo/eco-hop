/**
 * @fileoverview ESLint rule to require "use client" directive when using client-side features
 */

// React hooks that require "use client"
const REACT_HOOKS = new Set([
  "useState",
  "useEffect",
  "useContext",
  "useReducer",
  "useCallback",
  "useMemo",
  "useRef",
  "useImperativeHandle",
  "useLayoutEffect",
  "useDebugValue",
  "useDeferredValue",
  "useTransition",
  "useId",
  "useSyncExternalStore",
  "useInsertionEffect",
  "useOptimistic",
  "useFormStatus",
  "useFormState",
])

// Event handler props that require "use client"
const EVENT_HANDLERS = new Set([
  "onClick",
  "onChange",
  "onSubmit",
  "onBlur",
  "onFocus",
  "onInput",
  "onKeyDown",
  "onKeyUp",
  "onKeyPress",
  "onMouseDown",
  "onMouseUp",
  "onMouseEnter",
  "onMouseLeave",
  "onMouseMove",
  "onMouseOver",
  "onMouseOut",
  "onScroll",
  "onWheel",
  "onDrag",
  "onDragEnd",
  "onDragEnter",
  "onDragLeave",
  "onDragOver",
  "onDragStart",
  "onDrop",
  "onTouchStart",
  "onTouchMove",
  "onTouchEnd",
  "onTouchCancel",
  "onPointerDown",
  "onPointerUp",
  "onPointerEnter",
  "onPointerLeave",
  "onPointerMove",
  "onPointerOver",
  "onPointerOut",
  "onContextMenu",
  "onDoubleClick",
  "onCopy",
  "onCut",
  "onPaste",
  "onSelect",
  "onAnimationStart",
  "onAnimationEnd",
  "onAnimationIteration",
  "onTransitionEnd",
  "onLoad",
  "onError",
])

// Browser APIs that require "use client"
const BROWSER_APIS = new Set([
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "navigator",
  "location",
  "history",
  "alert",
  "confirm",
  "prompt",
])

// Client-only packages (importing from these requires "use client")
const CLIENT_PACKAGES = [
  "next-auth/react",
  "radix-ui",
  "@radix-ui",
  "react-hot-toast",
  "react-hook-form",
  "@tanstack/react-query",
]

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: 'Require "use client" directive when using client-side features',
      recommended: true,
    },
    fixable: "code",
    messages: {
      missingUseClient:
        '"use client" directive is required when using {{ feature }}. Add "use client" at the top of the file.',
      unnecessaryUseClient:
        '"use client" directive is not needed. This file does not use any client-side features.',
    },
    schema: [],
  },

  create(context) {
    let hasUseClientDirective = false
    let useClientNode = null
    let clientFeatureUsed = null
    let clientFeatureNode = null

    return {
      Program(node) {
        // Check if "use client" directive exists
        const firstStatement = node.body[0]
        if (
          firstStatement &&
          firstStatement.type === "ExpressionStatement" &&
          firstStatement.expression.type === "Literal" &&
          firstStatement.expression.value === "use client"
        ) {
          hasUseClientDirective = true
          useClientNode = firstStatement
        }
      },

      // Check for client-only package imports
      ImportDeclaration(node) {
        if (clientFeatureUsed) return

        const source = node.source.value
        if (typeof source === "string") {
          for (const pkg of CLIENT_PACKAGES) {
            if (source === pkg || source.startsWith(pkg + "/")) {
              clientFeatureUsed = `client package "${source}"`
              clientFeatureNode = node
              return
            }
          }
        }
      },

      // Check for React hooks and custom hooks (use* convention)
      CallExpression(node) {
        if (clientFeatureUsed) return

        const callee = node.callee
        if (callee.type === "Identifier") {
          if (REACT_HOOKS.has(callee.name)) {
            clientFeatureUsed = `React hook "${callee.name}"`
            clientFeatureNode = node
          } else if (/^use[A-Z]/.test(callee.name)) {
            clientFeatureUsed = `custom hook "${callee.name}"`
            clientFeatureNode = node
          }
        }
      },

      // Check for event handlers in JSX
      JSXAttribute(node) {
        if (clientFeatureUsed) return

        if (node.name.type === "JSXIdentifier" && EVENT_HANDLERS.has(node.name.name)) {
          clientFeatureUsed = `event handler "${node.name.name}"`
          clientFeatureNode = node
        }
      },

      // Check for browser APIs
      Identifier(node) {
        if (clientFeatureUsed) return
        if (!BROWSER_APIS.has(node.name)) return

        // Skip if it's a property access (e.g., obj.window)
        if (node.parent.type === "MemberExpression" && node.parent.property === node) {
          return
        }

        // Skip if it's a declaration
        if (node.parent.type === "VariableDeclarator" && node.parent.id === node) {
          return
        }

        // Skip if it's a function parameter
        if (
          node.parent.type === "FunctionDeclaration" ||
          node.parent.type === "ArrowFunctionExpression" ||
          node.parent.type === "FunctionExpression"
        ) {
          return
        }

        // Skip object / interface / type property keys (e.g., { history: ... })
        if (
          (node.parent.type === "Property" ||
            node.parent.type === "TSPropertySignature" ||
            node.parent.type === "TSMethodSignature") &&
          node.parent.key === node &&
          !node.parent.computed
        ) {
          return
        }

        // Skip if the identifier resolves to a local variable (parameter, let/const, etc.)
        const sourceCode = context.sourceCode || context.getSourceCode()
        const scope = sourceCode.getScope(node)
        let s = scope
        while (s) {
          if (s.type === "global" || s.type === "module") break
          if (s.set.has(node.name)) return
          s = s.upper
        }

        clientFeatureUsed = `browser API "${node.name}"`
        clientFeatureNode = node
      },

      "Program:exit"(node) {
        // Missing "use client"
        if (!hasUseClientDirective && clientFeatureUsed && clientFeatureNode) {
          context.report({
            node: clientFeatureNode,
            messageId: "missingUseClient",
            data: {
              feature: clientFeatureUsed,
            },
            fix(fixer) {
              return fixer.insertTextBefore(node.body[0], '"use client"\n\n')
            },
          })
        }

        // Unnecessary "use client"
        if (hasUseClientDirective && !clientFeatureUsed && useClientNode) {
          context.report({
            node: useClientNode,
            messageId: "unnecessaryUseClient",
            fix(fixer) {
              // Remove "use client" and any following empty lines
              const sourceCode = context.sourceCode || context.getSourceCode()
              const nextToken = sourceCode.getTokenAfter(useClientNode)
              const endRange = nextToken ? nextToken.range[0] : useClientNode.range[1]
              return fixer.removeRange([useClientNode.range[0], endRange])
            },
          })
        }
      },
    }
  },
}
