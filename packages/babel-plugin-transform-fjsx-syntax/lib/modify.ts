import * as babylon from "babylon";
import traverse from "@babel/traverse";
import { NodePath, Scope } from "babel-traverse";
import * as t from "@babel/types";
import { check } from "./check";
import { parameters } from "./parameters";

const fjsxValueInit = (
  init: t.Expression | t.PatternLike | t.SpreadElement | t.JSXNamespacedName
) => {
  return t.callExpression(
    t.memberExpression(
      t.identifier("fjsx"),
      t.identifier(t.isArrayExpression(init) ? "array" : "value")
    ),
    [init == null ? t.nullLiteral() : (init as any)]
  );
};

const fjsxCall = (
  left: t.Expression | t.RestElement | t.LVal,
  right: t.Expression,
  operator: string
) => {
  if (operator === "=") return t.callExpression(left as any, [right]);
  else {
    operator = operator.substr(0, 1);
    return t.callExpression(left as any, [
      t.binaryExpression(operator as any, left as any, right)
    ]);
  }
};

const assignmentExpressionToCallCompute = (
  expression: t.AssignmentExpression,
  fComputeParameters: any[]
) => {
  if (
    t.isMemberExpression(expression.left) &&
    t.isIdentifier(expression.left.object) &&
    expression.left.property.name == "$val"
  )
    return t.callExpression(
      t.memberExpression(t.identifier("fjsx"), t.identifier("compute")),
      [
        t.functionExpression(
          t.identifier(""),
          [],
          t.blockStatement([
            t.expressionStatement(
              t.callExpression(expression.left.object, [expression.right])
            )
          ])
        )
      ].concat(fComputeParameters)
    );
};

const binaryExpressionInitComputeValues = (
  expression: t.Expression,
  fComputeParameters: any[]
) => {
  return t.callExpression(
    t.memberExpression(t.identifier("fjsx"), t.identifier("initCompute")),
    [
      t.functionExpression(
        t.identifier(""),
        [],
        t.blockStatement([t.returnStatement(expression)])
      )
    ].concat(fComputeParameters)
  );
};

const fjsxAssignmentExpressionSetCompute = (
  expression: t.AssignmentExpression,
  fComputeParameters: any[]
) => {
  const leftName = t.isIdentifier(expression.left)
    ? expression.left.name
    : "TODO";
  return t.callExpression(
    t.memberExpression(t.identifier("fjsx"), t.identifier("setCompute")),
    [
      t.identifier(leftName),
      t.functionExpression(
        t.identifier(""),
        [],
        t.blockStatement([t.returnStatement(expression.right)])
      )
    ].concat(fComputeParameters)
  );
};

const expressionStatementGeneralProcess = (
  propertyName: string,
  path: NodePath<any>
) => {
  const expression: t.Expression = path.node[propertyName];
  if (t.isAssignmentExpression(expression)) {
    // const code = generate(path.node).code;
    if (t.isMemberExpression(expression.left)) {
      const leftIsTracked = check.isTrackedVariable(
        path.scope,
        expression.left
      );
      const rightIsTracked = check.isTrackedVariable(
        path.scope,
        expression.right
      );
      if (rightIsTracked) {
        if (leftIsTracked) {
          path.node[propertyName] = modify.fjsxCall(
            expression.left,
            expression.right,
            expression.operator
          );
        }
      } else {
        if (leftIsTracked) {
          path.node[propertyName] = modify.fjsxCall(
            expression.left,
            expression.right,
            expression.operator
          );
        }
      }
    }
    if (check.hasTrackedSetComment(path)) {
      if (
        !(
          t.isIdentifier(expression.right) &&
          check.isTrackedVariable(path.scope, expression.right)
        ) // @tracked != @tracked ...
      ) {
        const fComputeParameters = parameters.fjsxComputeParametersInExpressionWithScopeFilter(
          path.scope,
          expression.right
        );
        expression.right = modify.fjsxAssignmentExpressionSetCompute(
          expression,
          fComputeParameters
        );
      }
    } else if (check.isTrackedVariable(path.scope, expression.left)) {
      path.node[propertyName] = modify.fjsxCall(
        expression.left,
        expression.right,
        expression.operator
      );
    } else if (
      check.isTrackedVariable(path.scope, expression.right) &&
      !check.isExportsMember(expression.left)
    ) {
      expression.right = modify.memberVal(expression.right);
    }
  } else if (t.isUpdateExpression(expression)) {
    if (check.isTrackedVariable(path.scope, expression.argument)) {
      path.node[propertyName] = modify.fjsxCall(
        expression.argument,
        t.numericLiteral(1),
        expression.operator
      );
    }
  }
};

const memberVal = (
  expression:
    | t.Expression
    | t.SpreadElement
    | t.JSXNamespacedName
    | t.PatternLike
) => {
  if (t.isUnaryExpression(expression)) {
    expression.argument = t.memberExpression(
      expression.argument,
      t.identifier("$val")
    );
    return expression;
  } else return t.memberExpression(expression as any, t.identifier("$val"));
};

export const moveContextArguments = (args: any[], contextArgIndex: number) => {
  const contextArgProps: any[] = args[contextArgIndex].arguments[1].properties;
  const contextArgs = args[contextArgIndex].arguments.splice(2);
  contextArgs.push(
    t.callExpression(
      t.memberExpression(t.identifier("fjsx"), t.identifier("endContext")),
      [contextArgProps[0].value]
    )
  );
  args[contextArgIndex] = t.callExpression(
    t.memberExpression(t.identifier("fjsx"), t.identifier("startContext")),
    [contextArgProps[0].value, contextArgProps[1].value]
  );
  args.splice.apply(args, [contextArgIndex + 1, 0].concat(contextArgs));
};

export const modify = {
  fjsxValueInit,
  fjsxCall,
  memberVal,
  binaryExpressionInitComputeValues,
  assignmentExpressionToCallCompute,
  fjsxAssignmentExpressionSetCompute,
  expressionStatementGeneralProcess,
  moveContextArguments
};
