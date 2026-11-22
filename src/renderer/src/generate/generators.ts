import type {
  CodeTarget,
  DataTarget,
  DocTarget,
  Field,
  ModelDoc,
  NamingConvention,
  Project,
  SqlDialect
} from '@shared/types'
import {
  CODE_TARGET_LABELS,
  MODEL_KIND_LABELS,
  RELATION_LABELS,
  SQL_DIALECT_LABELS
} from '@shared/types'

export interface GenOptions {
  sqlDialect: SqlDialect
  naming: NamingConvention
}

const DEFAULT_OPTS: GenOptions = { sqlDialect: 'mysql', naming: 'snake_case' }

/* ----------------------------- 命名工具 ----------------------------- */

function identifierName(label: string): string {
  const en = label.match(/[A-Za-z][A-Za-z0-9_]*/g)
  if (en && en.length) return en.join('')
  return 'Entity_' + Math.abs(hashCode(label)).toString(36).slice(0, 4)
}

function toSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

function toPascal(s: string): string {
  return s.replace(/(^|_|\s)(\w)/g, (_, _b, c) => c.toUpperCase()).replace(/[_\s]/g, '')
}

function toCamel(s: string): string {
  const p = toPascal(s)
  return p.charAt(0).toLowerCase() + p.slice(1)
}

function applyNaming(s: string, naming: NamingConvention): string {
  const base = identifierName(s)
  switch (naming) {
    case 'snake_case':
      return toSnake(base)
    case 'camelCase':
      return toCamel(base)
    case 'PascalCase':
      return toPascal(base)
    case 'original':
      return base
  }
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

function comment(c?: string): string {
  return c ? ` // ${c}` : ''
}

/* ----------------------------- 类型归类 ----------------------------- */

type TypeCat =
  | { cat: 'int' }
  | { cat: 'long' }
  | { cat: 'decimal' }
  | { cat: 'float' }
  | { cat: 'double' }
  | { cat: 'bool' }
  | { cat: 'date' }
  | { cat: 'datetime' }
  | { cat: 'text' }
  | { cat: 'string'; len: number }

function categorize(t?: string): TypeCat {
  if (!t) return { cat: 'string', len: 255 }
  const u = t.toUpperCase().trim()
  const lenMatch = u.match(/\((\d+)/)
  const len = lenMatch ? parseInt(lenMatch[1], 10) : 255
  if (/TEXT|CLOB|LONGTEXT/.test(u)) return { cat: 'text' }
  if (/BIGINT|LONG/.test(u)) return { cat: 'long' }
  if (/DECIMAL|NUMERIC|MONEY/.test(u)) return { cat: 'decimal' }
  if (/DOUBLE/.test(u)) return { cat: 'double' }
  if (/FLOAT|REAL/.test(u)) return { cat: 'float' }
  if (/INT|INTEGER|SERIAL/.test(u)) return { cat: 'int' }
  if (/BOOL/.test(u)) return { cat: 'bool' }
  if (/DATETIME|TIMESTAMP/.test(u)) return { cat: 'datetime' }
  if (/DATE/.test(u)) return { cat: 'date' }
  if (/VARCHAR|CHAR|STRING|NVARCHAR|VARCHAR2/.test(u)) return { cat: 'string', len }
  return { cat: 'string', len }
}

function sqlType(t: string | undefined, dialect: SqlDialect): string {
  const c = categorize(t)
  const decimalDef = '(12,2)'
  switch (dialect) {
    case 'mysql':
      return {
        int: 'INT',
        long: 'BIGINT',
        decimal: `DECIMAL${decimalDef}`,
        float: 'FLOAT',
        double: 'DOUBLE',
        bool: 'TINYINT(1)',
        date: 'DATE',
        datetime: 'DATETIME',
        text: 'TEXT',
        string: c.cat === 'string' ? `VARCHAR(${c.len})` : 'VARCHAR(255)'
      }[c.cat]
    case 'postgres':
      return {
        int: 'INTEGER',
        long: 'BIGINT',
        decimal: `NUMERIC${decimalDef}`,
        float: 'REAL',
        double: 'DOUBLE PRECISION',
        bool: 'BOOLEAN',
        date: 'DATE',
        datetime: 'TIMESTAMP',
        text: 'TEXT',
        string: c.cat === 'string' ? `VARCHAR(${c.len})` : 'VARCHAR(255)'
      }[c.cat]
    case 'sqlserver':
      return {
        int: 'INT',
        long: 'BIGINT',
        decimal: `DECIMAL${decimalDef}`,
        float: 'REAL',
        double: 'FLOAT',
        bool: 'BIT',
        date: 'DATE',
        datetime: 'DATETIME2',
        text: 'NVARCHAR(MAX)',
        string: c.cat === 'string' ? `NVARCHAR(${c.len})` : 'NVARCHAR(255)'
      }[c.cat]
    case 'oracle':
      return {
        int: 'NUMBER(10)',
        long: 'NUMBER(19)',
        decimal: 'NUMBER(12,2)',
        float: 'BINARY_FLOAT',
        double: 'BINARY_DOUBLE',
        bool: 'NUMBER(1)',
        date: 'DATE',
        datetime: 'TIMESTAMP',
        text: 'CLOB',
        string: c.cat === 'string' ? `VARCHAR2(${c.len})` : 'VARCHAR2(255)'
      }[c.cat]
    case 'sqlite':
      return {
        int: 'INTEGER',
        long: 'INTEGER',
        decimal: 'NUMERIC',
        float: 'REAL',
        double: 'REAL',
        bool: 'INTEGER',
        date: 'TEXT',
        datetime: 'TEXT',
        text: 'TEXT',
        string: 'TEXT'
      }[c.cat]
  }
}

function javaType(t?: string): string {
  switch (categorize(t).cat) {
    case 'int':
      return 'Integer'
    case 'long':
      return 'Long'
    case 'decimal':
      return 'BigDecimal'
    case 'float':
      return 'Float'
    case 'double':
      return 'Double'
    case 'bool':
      return 'Boolean'
    case 'date':
      return 'LocalDate'
    case 'datetime':
      return 'LocalDateTime'
    default:
      return 'String'
  }
}

function pyType(t?: string): string {
  switch (categorize(t).cat) {
    case 'int':
    case 'long':
      return 'int'
    case 'decimal':
    case 'float':
    case 'double':
      return 'float'
    case 'bool':
      return 'bool'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    default:
      return 'str'
  }
}

function tsType(t?: string): string {
  switch (categorize(t).cat) {
    case 'int':
    case 'long':
    case 'decimal':
    case 'float':
    case 'double':
      return 'number'
    case 'bool':
      return 'boolean'
    default:
      return 'string'
  }
}

function goType(t?: string): string {
  switch (categorize(t).cat) {
    case 'int':
      return 'int'
    case 'long':
      return 'int64'
    case 'decimal':
    case 'double':
      return 'float64'
    case 'float':
      return 'float32'
    case 'bool':
      return 'bool'
    case 'date':
    case 'datetime':
      return 'time.Time'
    default:
      return 'string'
  }
}

function csharpType(t?: string): string {
  switch (categorize(t).cat) {
    case 'int':
      return 'int'
    case 'long':
      return 'long'
    case 'decimal':
      return 'decimal'
    case 'float':
      return 'float'
    case 'double':
      return 'double'
    case 'bool':
      return 'bool'
    case 'date':
    case 'datetime':
      return 'DateTime'
    default:
      return 'string'
  }
}

function prismaType(t?: string): string {
  switch (categorize(t).cat) {
    case 'int':
      return 'Int'
    case 'long':
      return 'BigInt'
    case 'decimal':
      return 'Decimal'
    case 'float':
    case 'double':
      return 'Float'
    case 'bool':
      return 'Boolean'
    case 'date':
    case 'datetime':
      return 'DateTime'
    default:
      return 'String'
  }
}

function mongooseType(t?: string): string {
  switch (categorize(t).cat) {
    case 'int':
    case 'long':
    case 'decimal':
    case 'float':
    case 'double':
      return 'Number'
    case 'bool':
      return 'Boolean'
    case 'date':
    case 'datetime':
      return 'Date'
    default:
      return 'String'
  }
}

function isAutoInc(f: Field, node: ModelDoc['nodes'][number]): boolean {
  if (f.autoIncrement) return true
  const pks = node.fields.filter((x) => x.primaryKey)
  const cat = categorize(f.type).cat
  return f.primaryKey === true && pks.length === 1 && (cat === 'int' || cat === 'long')
}

/* ----------------------------- 样例数据 ----------------------------- */

function sampleValue(field: Field, idx: number): unknown {
  const name = field.name.toLowerCase()
  const cat = categorize(field.type).cat
  if (field.primaryKey || /\bid$/.test(name)) return idx + 1
  if (/email|mail/.test(name)) return `user${idx + 1}@example.com`
  if (/phone|mobile|tel/.test(name)) return `1380000${String(1000 + idx).slice(-4)}`
  if (/name|title|username/.test(name)) return `示例${field.name}${idx + 1}`
  if (/price|amount|total|salary|money|fee/.test(name))
    return Number((99.9 * (idx + 1)).toFixed(2))
  if (/status|state/.test(name)) return ['active', 'pending', 'closed'][idx % 3]
  if (/quantity|count|stock|num|qty/.test(name)) return (idx + 1) * 2
  if (cat === 'datetime' || cat === 'date')
    return new Date(Date.UTC(2024, 0, 1 + idx, 8)).toISOString()
  if (cat === 'bool') return idx % 2 === 0
  if (cat === 'int' || cat === 'long') return (idx + 1) * 10
  if (cat === 'decimal' || cat === 'float' || cat === 'double')
    return Number(((idx + 1) * 12.5).toFixed(2))
  return `${field.name}_${idx + 1}`
}

export function generateData(
  doc: ModelDoc,
  target: DataTarget = 'json',
  opts: GenOptions = DEFAULT_OPTS,
  rows = 5
): string {
  if (target === 'json') {
    const out: Record<string, unknown[]> = {}
    for (const node of doc.nodes) {
      out[applyNaming(node.label, opts.naming)] = Array.from({ length: rows }, (_, i) => {
        const row: Record<string, unknown> = {}
        for (const f of node.fields) row[f.name] = sampleValue(f, i)
        return row
      })
    }
    return JSON.stringify(out, null, 2)
  }
  if (target === 'csv') {
    const blocks: string[] = []
    for (const node of doc.nodes) {
      const header = node.fields.map((f) => f.name).join(',')
      const lines = [`# ${node.label}`, header]
      for (let i = 0; i < rows; i++) {
        lines.push(
          node.fields
            .map((f) => {
              const v = sampleValue(f, i)
              const s = String(v)
              return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
            })
            .join(',')
        )
      }
      blocks.push(lines.join('\n'))
    }
    return blocks.join('\n\n')
  }
  // sqlInsert
  const lines: string[] = [`-- ${doc.name} 样例数据 (${SQL_DIALECT_LABELS[opts.sqlDialect]})`, '']
  for (const node of doc.nodes) {
    const tn = applyNaming(node.label, opts.naming)
    const cols = node.fields.map((f) => applyNaming(f.name, opts.naming))
    if (!cols.length) continue
    for (let i = 0; i < rows; i++) {
      const vals = node.fields.map((f) => {
        const v = sampleValue(f, i)
        const cat = categorize(f.type).cat
        if (cat === 'int' || cat === 'long' || cat === 'decimal' || cat === 'float' || cat === 'double')
          return String(v)
        if (cat === 'bool') return v ? '1' : '0'
        return `'${String(v).replace(/'/g, "''")}'`
      })
      lines.push(`INSERT INTO ${tn} (${cols.join(', ')}) VALUES (${vals.join(', ')});`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

/* ----------------------------- 代码生成 ----------------------------- */

export function generateCode(
  doc: ModelDoc,
  target: CodeTarget,
  opts: GenOptions = DEFAULT_OPTS
): string {
  switch (target) {
    case 'sql':
      return generateSql(doc, opts)
    case 'java-pojo':
      return generateJava(doc, false)
    case 'java-jpa':
      return generateJava(doc, true)
    case 'python-dataclass':
      return generatePyDataclass(doc)
    case 'python-sqlalchemy':
      return generatePySqlAlchemy(doc, opts)
    case 'python-pydantic':
      return generatePyPydantic(doc)
    case 'typescript-interface':
      return generateTsInterface(doc)
    case 'typescript-typeorm':
      return generateTsTypeOrm(doc, opts)
    case 'typescript-prisma':
      return generatePrisma(doc, opts)
    case 'go-struct':
      return generateGo(doc, opts)
    case 'csharp-class':
      return generateCsharp(doc)
    case 'mongoose':
      return generateMongoose(doc)
  }
}

function generateSql(doc: ModelDoc, opts: GenOptions): string {
  const { sqlDialect: dialect, naming } = opts
  const lines: string[] = [
    `-- ${doc.name} (${MODEL_KIND_LABELS[doc.kind]}) | ${SQL_DIALECT_LABELS[dialect]}`,
    ''
  ]
  const postComments: string[] = []
  for (const node of doc.nodes) {
    const tn = applyNaming(node.label, naming)
    lines.push(`CREATE TABLE ${tn} (`)
    const cols: string[] = []
    const pks: string[] = []
    for (const f of node.fields) {
      const col = applyNaming(f.name, naming)
      let def = `  ${col} `
      const auto = isAutoInc(f, node)
      if (auto && dialect === 'postgres') {
        def += categorize(f.type).cat === 'long' ? 'BIGSERIAL' : 'SERIAL'
      } else if (auto && dialect === 'sqlite' && f.primaryKey) {
        def += 'INTEGER PRIMARY KEY AUTOINCREMENT'
      } else {
        def += sqlType(f.type, dialect)
        if (auto && dialect === 'mysql') def += ' AUTO_INCREMENT'
        if (auto && dialect === 'sqlserver') def += ' IDENTITY(1,1)'
        if (auto && dialect === 'oracle') def += ' GENERATED BY DEFAULT AS IDENTITY'
      }
      if (!(dialect === 'sqlite' && auto && f.primaryKey)) {
        if (f.primaryKey || f.notNull) def += ' NOT NULL'
        if (f.unique && !f.primaryKey) def += ' UNIQUE'
        if (f.defaultValue) def += ` DEFAULT ${f.defaultValue}`
      }
      if (f.comment && dialect === 'mysql') def += ` COMMENT '${f.comment.replace(/'/g, "''")}'`
      if (f.comment && (dialect === 'postgres' || dialect === 'oracle')) {
        postComments.push(
          `COMMENT ON COLUMN ${tn}.${col} IS '${f.comment.replace(/'/g, "''")}';`
        )
      }
      cols.push(def)
      if (f.primaryKey) pks.push(col)
    }
    const sqlitePkInline = dialect === 'sqlite' && pks.length === 1 && node.fields.find((f) => f.primaryKey && isAutoInc(f, node))
    if (pks.length && !sqlitePkInline) cols.push(`  PRIMARY KEY (${pks.join(', ')})`)
    lines.push(cols.join(',\n'))
    lines.push(dialect === 'mysql' ? `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;` : `);`)
    if (node.comment && dialect === 'mysql') {
      // table comment already supported inline only via ALTER for simplicity
    }
    lines.push('')
  }
  // 外键
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]))
  for (const e of doc.edges) {
    if (!['fk', 'oneToMany', 'oneToOne'].includes(e.relation)) continue
    const parent = nodeById.get(e.source)
    const child = nodeById.get(e.target)
    if (!parent || !child) continue
    const fkField =
      e.targetField ||
      child.fields.find((f) => f.foreignKey)?.name ||
      `${applyNaming(parent.label, naming)}_id`
    const refField = e.sourceField || parent.fields.find((f) => f.primaryKey)?.name || 'id'
    lines.push(
      `ALTER TABLE ${applyNaming(child.label, naming)} ADD CONSTRAINT fk_${applyNaming(
        child.label,
        naming
      )}_${toSnake(fkField)} FOREIGN KEY (${applyNaming(fkField, naming)}) REFERENCES ${applyNaming(
        parent.label,
        naming
      )}(${applyNaming(refField, naming)});`
    )
  }
  if (postComments.length) {
    lines.push('')
    lines.push(...postComments)
  }
  return lines.join('\n')
}

function generateJava(doc: ModelDoc, jpa: boolean): string {
  const blocks: string[] = []
  for (const node of doc.nodes) {
    const cls = toPascal(identifierName(node.label))
    const lines: string[] = []
    if (jpa) {
      lines.push('import jakarta.persistence.*;')
    }
    lines.push('import java.time.*;')
    lines.push('import java.math.BigDecimal;')
    lines.push('')
    if (node.comment) lines.push(`/** ${node.comment} */`)
    if (jpa) {
      lines.push('@Entity')
      lines.push(`@Table(name = "${toSnake(identifierName(node.label))}")`)
    }
    lines.push(`public class ${cls} {`)
    for (const f of node.fields) {
      if (f.comment) lines.push(`    /** ${f.comment} */`)
      if (jpa) {
        if (f.primaryKey) {
          lines.push('    @Id')
          if (isAutoInc(f, node))
            lines.push('    @GeneratedValue(strategy = GenerationType.IDENTITY)')
        }
        const colAttrs: string[] = [`name = "${toSnake(f.name)}"`]
        if (f.notNull || f.primaryKey) colAttrs.push('nullable = false')
        if (f.unique) colAttrs.push('unique = true')
        lines.push(`    @Column(${colAttrs.join(', ')})`)
      }
      lines.push(`    private ${javaType(f.type)} ${toCamel(f.name)};`)
    }
    lines.push('')
    for (const f of node.fields) {
      const jt = javaType(f.type)
      const cap = toPascal(f.name)
      const cm = toCamel(f.name)
      lines.push(`    public ${jt} get${cap}() { return ${cm}; }`)
      lines.push(`    public void set${cap}(${jt} ${cm}) { this.${cm} = ${cm}; }`)
    }
    if (node.methods?.length) {
      lines.push('')
      for (const m of node.methods) {
        lines.push(
          `    public ${m.returnType ?? 'void'} ${toCamel(m.name)}(${m.params ?? ''}) {`
        )
        lines.push('        // TODO: implement')
        if ((m.returnType ?? 'void') !== 'void') lines.push('        return null;')
        lines.push('    }')
      }
    }
    lines.push('}')
    blocks.push(`// ===== ${cls}.java =====\n` + lines.join('\n'))
  }
  return blocks.join('\n\n')
}

function generatePyDataclass(doc: ModelDoc): string {
  const lines: string[] = [
    'from dataclasses import dataclass',
    'from datetime import datetime, date',
    'from typing import Optional',
    ''
  ]
  for (const node of doc.nodes) {
    const cls = toPascal(identifierName(node.label))
    lines.push('@dataclass')
    lines.push(`class ${cls}:`)
    if (node.comment) lines.push(`    """${node.comment}"""`)
    if (!node.fields.length) lines.push('    pass')
    for (const f of node.fields) {
      const pt = pyType(f.type)
      const required = f.notNull || f.primaryKey
      const typ = required ? pt : `Optional[${pt}]`
      const def = required ? '' : ' = None'
      lines.push(`    ${toSnake(f.name)}: ${typ}${def}${f.comment ? `  # ${f.comment}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function generatePyPydantic(doc: ModelDoc): string {
  const lines: string[] = [
    'from pydantic import BaseModel',
    'from datetime import datetime, date',
    'from typing import Optional',
    ''
  ]
  for (const node of doc.nodes) {
    const cls = toPascal(identifierName(node.label))
    lines.push(`class ${cls}(BaseModel):`)
    if (node.comment) lines.push(`    """${node.comment}"""`)
    if (!node.fields.length) lines.push('    pass')
    for (const f of node.fields) {
      const pt = pyType(f.type)
      const required = f.notNull || f.primaryKey
      const typ = required ? pt : `Optional[${pt}] = None`
      lines.push(`    ${toSnake(f.name)}: ${typ}${f.comment ? `  # ${f.comment}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function generatePySqlAlchemy(doc: ModelDoc, opts: GenOptions): string {
  const lines: string[] = [
    'from sqlalchemy import Column, Integer, BigInteger, String, Text, Numeric, Float, Boolean, Date, DateTime, ForeignKey',
    'from sqlalchemy.orm import declarative_base, relationship',
    '',
    'Base = declarative_base()',
    ''
  ]
  const saType = (t?: string): string => {
    switch (categorize(t).cat) {
      case 'int':
        return 'Integer'
      case 'long':
        return 'BigInteger'
      case 'decimal':
        return 'Numeric(12, 2)'
      case 'float':
      case 'double':
        return 'Float'
      case 'bool':
        return 'Boolean'
      case 'date':
        return 'Date'
      case 'datetime':
        return 'DateTime'
      case 'text':
        return 'Text'
      default:
        return 'String(255)'
    }
  }
  for (const node of doc.nodes) {
    const cls = toPascal(identifierName(node.label))
    lines.push(`class ${cls}(Base):`)
    lines.push(`    __tablename__ = "${applyNaming(node.label, opts.naming)}"`)
    if (node.comment) lines.push(`    # ${node.comment}`)
    if (!node.fields.length) lines.push('    pass')
    for (const f of node.fields) {
      const args: string[] = [saType(f.type)]
      if (f.primaryKey) args.push('primary_key=True')
      if (f.notNull && !f.primaryKey) args.push('nullable=False')
      if (f.unique) args.push('unique=True')
      lines.push(`    ${toSnake(f.name)} = Column(${args.join(', ')})`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function generateTsInterface(doc: ModelDoc): string {
  const lines: string[] = []
  for (const node of doc.nodes) {
    const cls = toPascal(identifierName(node.label))
    if (node.comment) lines.push(`/** ${node.comment} */`)
    lines.push(`export interface ${cls} {`)
    for (const f of node.fields) {
      const optional = f.notNull || f.primaryKey ? '' : '?'
      lines.push(`  ${toCamel(f.name)}${optional}: ${tsType(f.type)};${comment(f.comment)}`)
    }
    lines.push('}')
    lines.push('')
  }
  return lines.join('\n')
}

function generateTsTypeOrm(doc: ModelDoc, opts: GenOptions): string {
  const lines: string[] = [
    "import { Entity, PrimaryGeneratedColumn, PrimaryColumn, Column } from 'typeorm';",
    ''
  ]
  for (const node of doc.nodes) {
    const cls = toPascal(identifierName(node.label))
    if (node.comment) lines.push(`/** ${node.comment} */`)
    lines.push(`@Entity({ name: '${applyNaming(node.label, opts.naming)}' })`)
    lines.push(`export class ${cls} {`)
    for (const f of node.fields) {
      if (f.primaryKey) {
        lines.push(isAutoInc(f, node) ? '  @PrimaryGeneratedColumn()' : '  @PrimaryColumn()')
      } else {
        const attrs: string[] = []
        if (!f.notNull) attrs.push('nullable: true')
        if (f.unique) attrs.push('unique: true')
        lines.push(`  @Column(${attrs.length ? `{ ${attrs.join(', ')} }` : ''})`)
      }
      lines.push(`  ${toCamel(f.name)}: ${tsType(f.type)};`)
    }
    lines.push('}')
    lines.push('')
  }
  return lines.join('\n')
}

function generatePrisma(doc: ModelDoc, opts: GenOptions): string {
  const provider =
    opts.sqlDialect === 'postgres'
      ? 'postgresql'
      : opts.sqlDialect === 'sqlserver'
        ? 'sqlserver'
        : opts.sqlDialect === 'sqlite'
          ? 'sqlite'
          : 'mysql'
  const lines: string[] = [
    'datasource db {',
    `  provider = "${provider}"`,
    '  url      = env("DATABASE_URL")',
    '}',
    '',
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    ''
  ]
  for (const node of doc.nodes) {
    const cls = toPascal(identifierName(node.label))
    if (node.comment) lines.push(`/// ${node.comment}`)
    lines.push(`model ${cls} {`)
    for (const f of node.fields) {
      const opt = f.notNull || f.primaryKey ? '' : '?'
      const attrs: string[] = []
      if (f.primaryKey) attrs.push('@id')
      if (isAutoInc(f, node)) attrs.push('@default(autoincrement())')
      if (f.unique && !f.primaryKey) attrs.push('@unique')
      lines.push(
        `  ${toCamel(f.name)} ${prismaType(f.type)}${opt}${attrs.length ? ' ' + attrs.join(' ') : ''}`
      )
    }
    lines.push('}')
    lines.push('')
  }
  return lines.join('\n')
}

function generateGo(doc: ModelDoc, opts: GenOptions): string {
  const needTime = doc.nodes.some((n) =>
    n.fields.some((f) => ['date', 'datetime'].includes(categorize(f.type).cat))
  )
  const lines: string[] = ['package model', '']
  if (needTime) lines.push('import "time"', '')
  for (const node of doc.nodes) {
    const cls = toPascal(identifierName(node.label))
    if (node.comment) lines.push(`// ${cls} ${node.comment}`)
    lines.push(`type ${cls} struct {`)
    for (const f of node.fields) {
      const field = toPascal(f.name)
      const tag = `\`json:"${toCamel(f.name)}" db:"${applyNaming(f.name, opts.naming)}"\``
      lines.push(`\t${field} ${goType(f.type)} ${tag}${f.comment ? ` // ${f.comment}` : ''}`)
    }
    lines.push('}')
    lines.push('')
  }
  return lines.join('\n')
}

function generateCsharp(doc: ModelDoc): string {
  const lines: string[] = ['using System;', '', 'namespace Domain.Models', '{']
  for (const node of doc.nodes) {
    const cls = toPascal(identifierName(node.label))
    if (node.comment) lines.push(`    /// <summary>${node.comment}</summary>`)
    lines.push(`    public class ${cls}`)
    lines.push('    {')
    for (const f of node.fields) {
      const t = csharpType(f.type)
      const nullable = f.notNull || f.primaryKey || t === 'string' ? '' : '?'
      lines.push(`        public ${t}${nullable} ${toPascal(f.name)} { get; set; }`)
    }
    lines.push('    }')
  }
  lines.push('}')
  return lines.join('\n')
}

function generateMongoose(doc: ModelDoc): string {
  const lines: string[] = ["const mongoose = require('mongoose');", "const { Schema } = mongoose;", '']
  for (const node of doc.nodes) {
    const cls = toPascal(identifierName(node.label))
    lines.push(`const ${cls}Schema = new Schema({`)
    for (const f of node.fields) {
      if (f.primaryKey && /\bid$/i.test(f.name)) continue
      const attrs: string[] = [`type: ${mongooseType(f.type)}`]
      if (f.notNull) attrs.push('required: true')
      if (f.unique) attrs.push('unique: true')
      lines.push(`  ${toCamel(f.name)}: { ${attrs.join(', ')} },`)
    }
    lines.push('}, { timestamps: true });')
    lines.push(`module.exports = mongoose.model('${cls}', ${cls}Schema);`)
    lines.push('')
  }
  return lines.join('\n')
}

/* ----------------------------- 文档生成 ----------------------------- */

export function generateDoc(doc: ModelDoc, target: DocTarget): string {
  switch (target) {
    case 'requirementDoc':
      return generateRequirementDoc(doc)
    case 'dataDictionary':
      return generateDataDictionary(doc)
    case 'aiSpec':
      return generateAiSpec(doc)
    case 'aiPrompt':
      return generateAIDevPrompt(doc)
  }
}

export function generateAIDevPrompt(doc: ModelDoc): string {
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]))
  const lines: string[] = []
  lines.push(`# AI 开发提示词：${doc.name}`)
  lines.push('')
  lines.push('## 角色')
  lines.push(
    `你是一名资深全栈工程师，请基于以下 ${MODEL_KIND_LABELS[doc.kind]} 实现一个完整可运行的系统。`
  )
  lines.push('')
  if (doc.description) {
    lines.push('## 背景')
    lines.push(doc.description)
    lines.push('')
  }
  lines.push('## 推荐技术栈')
  lines.push('- 后端：Spring Boot / NestJS / FastAPI（任选其一）')
  lines.push('- 数据库：PostgreSQL 或 MySQL')
  lines.push('- 前端：React + TypeScript')
  lines.push('')
  lines.push('## 数据结构 / 实体')
  for (const node of doc.nodes) {
    lines.push(`### ${node.label}${node.comment ? `（${node.comment}）` : ''}`)
    for (const f of node.fields) {
      const flags = [
        f.primaryKey ? '主键' : '',
        f.foreignKey ? '外键' : '',
        f.unique ? '唯一' : '',
        f.notNull ? '非空' : ''
      ]
        .filter(Boolean)
        .join('/')
      lines.push(
        `- ${f.name}: ${f.type ?? '—'}${flags ? ` [${flags}]` : ''}${
          f.comment ? ` — ${f.comment}` : ''
        }`
      )
    }
    if (node.methods?.length) {
      lines.push('- 方法：')
      node.methods.forEach((m) =>
        lines.push(`  - ${m.name}(${m.params ?? ''}): ${m.returnType ?? 'void'}`)
      )
    }
    lines.push('')
  }
  if (doc.edges.length) {
    lines.push('## 关系')
    for (const e of doc.edges) {
      const s = nodeById.get(e.source)?.label ?? e.source
      const t = nodeById.get(e.target)?.label ?? e.target
      lines.push(`- ${s} —[${RELATION_LABELS[e.relation]}${e.label ? ':' + e.label : ''}]→ ${t}`)
    }
    lines.push('')
  }
  lines.push('## 实现要求')
  lines.push('1. 根据上述实体生成数据库迁移脚本与 ORM 模型。')
  lines.push('2. 为每个实体实现 CRUD 的 REST API，并处理关系（外键、级联）。')
  lines.push('3. 编写输入校验、错误处理与单元测试。')
  lines.push('4. 提供前端基础页面（列表/详情/表单）。')
  lines.push('5. 输出可运行的项目结构与启动说明。')
  return lines.join('\n')
}

/** AI 可解析的结构化规格说明 */
export function generateAiSpec(doc: ModelDoc): string {
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]))
  const lines: string[] = []
  lines.push(`# MODEL SPEC: ${doc.name}`)
  lines.push('')
  lines.push(
    '> 本文件为机器可读的模型规格说明，供 AI 编程助手解析并据此生成系统。请严格按照下述结构理解实体、字段、约束与关系。'
  )
  lines.push('')
  const isOntology = doc.kind === 'conceptual'
  lines.push('## META')
  lines.push('```yaml')
  lines.push(`name: ${JSON.stringify(doc.name)}`)
  lines.push(`kind: ${doc.kind}`)
  lines.push(`kindLabel: ${MODEL_KIND_LABELS[doc.kind]}`)
  if (isOntology) lines.push('paradigm: ontology  # Palantir 风格本体语义建模')
  lines.push(`entityCount: ${doc.nodes.length}`)
  lines.push(`relationCount: ${doc.edges.length}`)
  if (doc.description) lines.push(`description: ${JSON.stringify(doc.description)}`)
  lines.push('```')
  lines.push('')
  if (isOntology) {
    lines.push(generateOntologySection(doc, nodeById))
    lines.push('')
  }
  lines.push(isOntology ? '## OBJECT-TYPES (detail)' : '## ENTITIES')
  for (const node of doc.nodes) {
    lines.push('')
    lines.push(`### ${node.label}`)
    if (node.stereotype) lines.push(`stereotype: ${node.stereotype}`)
    if (node.comment) lines.push(`description: ${node.comment}`)
    if (node.category) lines.push(`category: ${node.category}`)
    lines.push('')
    lines.push('| field | type | pk | fk | title | unique | notNull | default | comment |')
    lines.push('| --- | --- | :-: | :-: | :-: | :-: | :-: | --- | --- |')
    for (const f of node.fields) {
      lines.push(
        `| ${f.name} | ${f.type ?? ''} | ${f.primaryKey ? 'Y' : ''} | ${
          f.foreignKey ? 'Y' : ''
        } | ${f.isTitle ? 'Y' : ''} | ${f.unique ? 'Y' : ''} | ${f.notNull ? 'Y' : ''} | ${
          f.defaultValue ?? ''
        } | ${f.comment ?? ''} |`
      )
    }
    if (node.methods?.length) {
      lines.push('')
      lines.push('methods:')
      node.methods.forEach((m) =>
        lines.push(
          `- ${m.visibility ?? 'public'} ${m.name}(${m.params ?? ''}): ${m.returnType ?? 'void'}`
        )
      )
    }
  }
  lines.push('')
  lines.push('## RELATIONSHIPS')
  if (!doc.edges.length) {
    lines.push('（无）')
  } else {
    lines.push('| from | relation | to | sourceCard | targetCard | fromField | toField | label |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const e of doc.edges) {
      const s = nodeById.get(e.source)?.label ?? e.source
      const t = nodeById.get(e.target)?.label ?? e.target
      lines.push(
        `| ${s} | ${e.relation} | ${t} | ${e.sourceCardinality ?? ''} | ${
          e.targetCardinality ?? ''
        } | ${e.sourceField ?? ''} | ${e.targetField ?? ''} | ${e.label ?? ''} |`
      )
    }
  }
  lines.push('')
  lines.push('## INSTRUCTIONS-FOR-AI')
  if (isOntology) {
    lines.push('1. 本文件描述一套本体（Ontology）：stereotype=object 为对象类型，link 为链接类型，action 为动作类型，value 为共享值类型。')
    lines.push('2. 每个对象类型的 field 为其属性(Property)；pk 为主键属性，title 为对象标题属性(用于展示)。')
    lines.push('3. RELATIONSHIPS 为链接类型(Link Type)，sourceCard/targetCard 为两端基数(如 1、0..1、*、1..*)。')
    lines.push('4. 据此可生成：本体定义(如 Foundry OSDK / GraphQL schema)、实体表与关联表、对象服务 API 与权限模型。')
  } else {
    lines.push('1. 将每个 ENTITY 视为一张数据表/一个领域对象，field 行即字段定义。')
    lines.push('2. pk=主键，fk=外键，unique=唯一约束，notNull=非空约束。')
    lines.push('3. RELATIONSHIPS 描述实体间关系，relation 取值含义见标准 ER/UML 语义。')
    lines.push('4. 据此生成数据库 DDL、ORM 模型、CRUD API 与必要的校验逻辑。')
  }
  return lines.join('\n')
}

/** 本体语义概览：按构造型分组列出对象类型/链接类型/动作类型/值类型 */
function generateOntologySection(
  doc: ModelDoc,
  nodeById: Map<string, ModelDoc['nodes'][number]>
): string {
  const out: string[] = []
  out.push('## ONTOLOGY')
  const groups: { key: string; title: string }[] = [
    { key: 'object', title: 'Object Types 对象类型' },
    { key: 'link', title: 'Link Types 链接类型' },
    { key: 'action', title: 'Action Types 动作类型' },
    { key: 'value', title: 'Value Types 值类型' }
  ]
  for (const g of groups) {
    const members = doc.nodes.filter((n) => (n.stereotype ?? 'object') === g.key)
    if (!members.length) continue
    out.push('')
    out.push(`### ${g.title}`)
    for (const n of members) {
      const title = n.fields.find((f) => f.isTitle)?.name
      const pk = n.fields.find((f) => f.primaryKey)?.name
      const meta = [pk ? `primaryKey=${pk}` : '', title ? `title=${title}` : '']
        .filter(Boolean)
        .join(', ')
      out.push(`- **${n.label}**${meta ? ` (${meta})` : ''}${n.comment ? ` — ${n.comment}` : ''}`)
    }
  }
  // 链接类型：以带基数的边表达
  if (doc.edges.length) {
    out.push('')
    out.push('### Links 链接（含基数）')
    for (const e of doc.edges) {
      const s = nodeById.get(e.source)?.label ?? e.source
      const t = nodeById.get(e.target)?.label ?? e.target
      const sc = e.sourceCardinality ? `[${e.sourceCardinality}]` : ''
      const tc = e.targetCardinality ? `[${e.targetCardinality}]` : ''
      out.push(`- ${s} ${sc} — ${e.label ?? e.relation} — ${tc} ${t}`)
    }
  }
  return out.join('\n')
}

/** 转义 mermaid 标签中的双引号 */
function mmLabel(text: string): string {
  return (text || '').replace(/"/g, "'").replace(/[\r\n]+/g, ' ').trim()
}

/**
 * 由模型生成 mermaid 图源码。
 * - uml / 含方法：classDiagram（展示字段与方法）
 * - architecture：flowchart（组件依赖框图）
 * - 其它（概念/逻辑/物理）：flowchart 实体关系图（标签兼容中文，稳定可渲染）
 */
export function mermaidFromModel(doc: ModelDoc): string {
  if (doc.nodes.length === 0) return ''
  const idOf = new Map<string, string>()
  doc.nodes.forEach((n, i) => idOf.set(n.id, `N${i + 1}`))
  const isUml = doc.kind === 'uml' || doc.nodes.some((n) => (n.methods?.length ?? 0) > 0)

  if (isUml) {
    const lines: string[] = ['classDiagram']
    doc.nodes.forEach((n) => {
      const id = idOf.get(n.id)!
      lines.push(`  class ${id}["${mmLabel(n.label)}"] {`)
      n.fields.slice(0, 12).forEach((f) => {
        const vis = f.primaryKey ? '+' : '-'
        lines.push(`    ${vis}${mmLabel(f.type ?? '')} ${mmLabel(f.name)}`)
      })
      ;(n.methods ?? []).slice(0, 8).forEach((m) => {
        lines.push(`    +${mmLabel(m.name)}() ${mmLabel(m.returnType ?? 'void')}`)
      })
      lines.push('  }')
    })
    doc.edges.forEach((e) => {
      const s = idOf.get(e.source)
      const t = idOf.get(e.target)
      if (!s || !t) return
      const lbl = mmLabel(e.label || RELATION_LABELS[e.relation])
      lines.push(`  ${s} --> ${t}${lbl ? ` : ${lbl}` : ''}`)
    })
    return lines.join('\n')
  }

  const lines: string[] = ['flowchart LR']
  doc.nodes.forEach((n) => {
    lines.push(`  ${idOf.get(n.id)}["${mmLabel(n.label)}"]`)
  })
  doc.edges.forEach((e) => {
    const s = idOf.get(e.source)
    const t = idOf.get(e.target)
    if (!s || !t) return
    const lbl = mmLabel(e.label || RELATION_LABELS[e.relation])
    lines.push(`  ${s} -->${lbl ? `|"${lbl}"|` : ''} ${t}`)
  })
  return lines.join('\n')
}

/** 包成 markdown mermaid 代码块（供文档预览渲染） */
function mermaidBlock(doc: ModelDoc): string[] {
  const src = mermaidFromModel(doc)
  if (!src) return []
  return ['## 模型图', '', '```mermaid', src, '```', '']
}

export function generateDataDictionary(doc: ModelDoc): string {
  const lines: string[] = []
  lines.push(`# ${doc.name} 数据字典`)
  lines.push('')
  lines.push(
    `> 模型类型：${MODEL_KIND_LABELS[doc.kind]} | 实体数：${doc.nodes.length} | 生成时间：${new Date().toLocaleString(
      'zh-CN'
    )}`
  )
  lines.push('')
  lines.push(...mermaidBlock(doc))
  lines.push('## 实体清单')
  lines.push('| # | 实体 | 标识名 | 字段数 | 说明 |')
  lines.push('| --: | --- | --- | --: | --- |')
  doc.nodes.forEach((n, i) =>
    lines.push(
      `| ${i + 1} | ${n.label} | ${toSnake(identifierName(n.label))} | ${n.fields.length} | ${
        n.comment ?? ''
      } |`
    )
  )
  lines.push('')
  for (const node of doc.nodes) {
    lines.push(`## ${node.label}`)
    if (node.comment) lines.push(`> ${node.comment}`)
    lines.push('')
    lines.push('| 字段 | 类型 | 主键 | 外键 | 唯一 | 非空 | 默认值 | 说明 |')
    lines.push('| --- | --- | :-: | :-: | :-: | :-: | --- | --- |')
    for (const f of node.fields) {
      lines.push(
        `| ${f.name} | ${f.type ?? '—'} | ${f.primaryKey ? '✓' : ''} | ${
          f.foreignKey ? '✓' : ''
        } | ${f.unique ? '✓' : ''} | ${f.notNull ? '✓' : ''} | ${f.defaultValue ?? ''} | ${
          f.comment ?? ''
        } |`
      )
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function generateRequirementDoc(doc: ModelDoc): string {
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]))
  const lines: string[] = []
  lines.push(`# ${doc.name} 需求文档`)
  lines.push('')
  lines.push(
    `> 模型类型：${MODEL_KIND_LABELS[doc.kind]} | 生成时间：${new Date().toLocaleString('zh-CN')}`
  )
  lines.push('')
  lines.push('## 1. 背景与目标')
  lines.push(doc.description || '（请补充项目背景与目标）')
  lines.push('')
  lines.push(...mermaidBlock(doc))
  lines.push('## 2. 功能需求')
  doc.nodes.forEach((node, i) => {
    lines.push(`- FR-${i + 1}：系统应支持对【${node.label}】的创建、查询、更新与删除。`)
  })
  lines.push('')
  lines.push('## 3. 数据模型')
  doc.nodes.forEach((node, idx) => {
    lines.push(`### 3.${idx + 1} ${node.label}`)
    if (node.comment) lines.push(node.comment)
    lines.push('')
    lines.push('| 字段 | 类型 | 主键 | 外键 | 非空 | 说明 |')
    lines.push('| --- | --- | :---: | :---: | :---: | --- |')
    for (const f of node.fields) {
      lines.push(
        `| ${f.name} | ${f.type ?? '—'} | ${f.primaryKey ? '✓' : ''} | ${
          f.foreignKey ? '✓' : ''
        } | ${f.notNull ? '✓' : ''} | ${f.comment ?? ''} |`
      )
    }
    lines.push('')
  })
  if (doc.edges.length) {
    lines.push('## 4. 实体关系')
    lines.push('| 源实体 | 关系 | 目标实体 | 说明 |')
    lines.push('| --- | --- | --- | --- |')
    for (const e of doc.edges) {
      const s = nodeById.get(e.source)?.label ?? e.source
      const t = nodeById.get(e.target)?.label ?? e.target
      lines.push(`| ${s} | ${RELATION_LABELS[e.relation]} | ${t} | ${e.label ?? ''} |`)
    }
    lines.push('')
  }
  lines.push('## 5. 非功能性需求')
  lines.push('- 性能：关键接口响应时间 < 500ms。')
  lines.push('- 安全：身份认证与授权、敏感数据加密存储。')
  lines.push('- 可用性：服务可用性 ≥ 99.9%。')
  lines.push('- 可维护性：模块化设计、完善日志与监控。')
  return lines.join('\n')
}

/* ----------------------------- 批量产物 ----------------------------- */

export interface ArtifactFile {
  filename: string
  content: string
}

/** 生成单个模型的全部产物文件集合 */
export function generateAllArtifacts(doc: ModelDoc, opts: GenOptions): ArtifactFile[] {
  const base = toSnake(identifierName(doc.name)) || 'model'
  const files: ArtifactFile[] = [
    { filename: `${base}.model.json`, content: JSON.stringify(doc, null, 2) },
    { filename: `${base}.schema.sql`, content: generateCode(doc, 'sql', opts) },
    { filename: `${base}.entities.java`, content: generateCode(doc, 'java-jpa', opts) },
    { filename: `${base}.models.py`, content: generateCode(doc, 'python-sqlalchemy', opts) },
    { filename: `${base}.types.ts`, content: generateCode(doc, 'typescript-interface', opts) },
    { filename: `${base}.requirement.md`, content: generateRequirementDoc(doc) },
    { filename: `${base}.data-dictionary.md`, content: generateDataDictionary(doc) },
    { filename: `${base}.ai-spec.md`, content: generateAiSpec(doc) },
    { filename: `${base}.ai-prompt.md`, content: generateAIDevPrompt(doc) },
    { filename: `${base}.sample-data.json`, content: generateData(doc, 'json', opts) }
  ]
  return files
}

/** 整个项目的全部产物（按模型分目录前缀） */
export function generateProjectArtifacts(project: Project, opts: GenOptions): ArtifactFile[] {
  const out: ArtifactFile[] = []
  for (const m of project.models) {
    const dir = toSnake(identifierName(m.name)) || m.id
    for (const f of generateAllArtifacts(m, opts)) {
      out.push({ filename: `${dir}/${f.filename}`, content: f.content })
    }
  }
  out.push({
    filename: 'project.json',
    content: JSON.stringify(project, null, 2)
  })
  return out
}

export function codeTargetLabel(target: CodeTarget): string {
  return CODE_TARGET_LABELS[target]
}
