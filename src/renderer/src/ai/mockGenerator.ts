import { nanoid } from 'nanoid'
import type {
  DiagramNode,
  ModelDoc,
  ModelKind,
  NodeStereotype,
  RelationKind
} from '@shared/types'

/**
 * 内置「模拟」生成器：无需任何 API Key 即可生成结构合理的模型，
 * 用于离线演示与无密钥环境。基于关键词匹配领域模板。
 */

interface TemplateEntity {
  label: string
  category?: string
  stereotype?: NodeStereotype
  fields: {
    name: string
    type: string
    pk?: boolean
    fk?: boolean
    title?: boolean
    comment?: string
  }[]
  methods?: { name: string; returnType: string; params?: string }[]
}

interface Template {
  name: string
  description: string
  keywords: string[]
  /** 标记为本体语义建模模板：概念模型生成时套用本体构造型/基数 */
  ontology?: boolean
  entities: TemplateEntity[]
  edges: {
    source: string
    target: string
    relation: RelationKind
    label?: string
    sourceCardinality?: string
    targetCardinality?: string
  }[]
}

const TEMPLATES: Template[] = [
  {
    name: 'Palantir 风格本体语义建模平台',
    description:
      '类 Palantir Foundry Ontology 的本体语义建模系统：以对象类型(Object Type)、属性(Property)、链接类型(Link Type)、动作类型(Action Type)、函数(Function)与底层数据集(Dataset)构成的语义层，将物理数据映射为业务对象与关系。',
    keywords: [
      'palantir',
      '本体',
      'ontology',
      '语义',
      'semantic',
      'foundry',
      '知识图谱',
      'object type',
      '对象类型',
      '语义建模'
    ],
    ontology: true,
    entities: [
      {
        label: '对象类型 ObjectType',
        stereotype: 'object',
        fields: [
          { name: 'apiName', type: 'string', pk: true, title: true, comment: '对象类型唯一 API 名' },
          { name: 'displayName', type: 'string', comment: '展示名' },
          { name: 'pluralDisplayName', type: 'string', comment: '复数展示名' },
          { name: 'description', type: 'string', comment: '业务语义描述' },
          { name: 'icon', type: 'string', comment: '图标' },
          { name: 'groupName', type: 'string', comment: '所属业务域分组' }
        ]
      },
      {
        label: '属性 Property',
        stereotype: 'value',
        fields: [
          { name: 'apiName', type: 'string', pk: true, title: true, comment: '属性 API 名' },
          { name: 'displayName', type: 'string', comment: '展示名' },
          { name: 'baseType', type: 'string', comment: '数据类型 String/Integer/Timestamp/Geohash 等' },
          { name: 'isTitleKey', type: 'boolean', comment: '是否对象标题属性' },
          { name: 'isPrimaryKey', type: 'boolean', comment: '是否主键属性' },
          { name: 'required', type: 'boolean', comment: '是否必填' },
          { name: 'valueType', type: 'string', comment: '引用的共享值类型(可选)' }
        ]
      },
      {
        label: '链接类型 LinkType',
        stereotype: 'link',
        fields: [
          { name: 'apiName', type: 'string', pk: true, title: true, comment: '链接 API 名' },
          { name: 'displayName', type: 'string', comment: '展示名' },
          { name: 'cardinality', type: 'string', comment: 'ONE_TO_ONE/ONE_TO_MANY/MANY_TO_MANY' },
          { name: 'sourceObject', type: 'string', comment: '源对象类型' },
          { name: 'targetObject', type: 'string', comment: '目标对象类型' }
        ]
      },
      {
        label: '动作类型 ActionType',
        stereotype: 'action',
        fields: [
          { name: 'apiName', type: 'string', pk: true, title: true, comment: '动作 API 名' },
          { name: 'displayName', type: 'string', comment: '展示名' },
          { name: 'appliesTo', type: 'string', comment: '作用的对象类型' },
          { name: 'operationType', type: 'string', comment: 'CREATE/MODIFY/DELETE' },
          { name: 'parameters', type: 'string', comment: '参数定义(JSON)' }
        ]
      },
      {
        label: '函数 Function',
        stereotype: 'action',
        fields: [
          { name: 'apiName', type: 'string', pk: true, title: true, comment: '函数 API 名' },
          { name: 'returnType', type: 'string', comment: '返回类型' },
          { name: 'expression', type: 'string', comment: '计算表达式/逻辑' }
        ]
      },
      {
        label: '值类型 ValueType',
        stereotype: 'value',
        fields: [
          { name: 'apiName', type: 'string', pk: true, title: true, comment: '共享值类型 API 名' },
          { name: 'baseType', type: 'string', comment: '基础类型' },
          { name: 'constraints', type: 'string', comment: '取值约束/枚举' }
        ]
      },
      {
        label: '数据集 Dataset',
        stereotype: 'object',
        fields: [
          { name: 'rid', type: 'string', pk: true, title: true, comment: '资源 RID' },
          { name: 'path', type: 'string', comment: '数据集路径' },
          { name: 'schema', type: 'string', comment: '列结构' },
          { name: 'branch', type: 'string', comment: '分支' }
        ]
      },
      {
        label: '映射 Mapping',
        stereotype: 'object',
        fields: [
          { name: 'id', type: 'string', pk: true, title: true, comment: '映射ID' },
          { name: 'datasetColumn', type: 'string', comment: '数据集列' },
          { name: 'propertyApiName', type: 'string', comment: '映射到的属性' }
        ]
      }
    ],
    edges: [
      {
        source: '对象类型 ObjectType',
        target: '属性 Property',
        relation: 'oneToMany',
        label: '拥有属性',
        sourceCardinality: '1',
        targetCardinality: '1..*'
      },
      {
        source: '对象类型 ObjectType',
        target: '链接类型 LinkType',
        relation: 'oneToMany',
        label: '作为源对象',
        sourceCardinality: '1',
        targetCardinality: '*'
      },
      {
        source: '链接类型 LinkType',
        target: '对象类型 ObjectType',
        relation: 'manyToMany',
        label: '指向目标对象',
        sourceCardinality: '*',
        targetCardinality: '1'
      },
      {
        source: '对象类型 ObjectType',
        target: '动作类型 ActionType',
        relation: 'oneToMany',
        label: '可执行动作',
        sourceCardinality: '1',
        targetCardinality: '*'
      },
      {
        source: '属性 Property',
        target: '值类型 ValueType',
        relation: 'manyToMany',
        label: '引用值类型',
        sourceCardinality: '*',
        targetCardinality: '0..1'
      },
      {
        source: '动作类型 ActionType',
        target: '函数 Function',
        relation: 'manyToMany',
        label: '调用函数',
        sourceCardinality: '*',
        targetCardinality: '*'
      },
      {
        source: '数据集 Dataset',
        target: '映射 Mapping',
        relation: 'oneToMany',
        label: '提供列',
        sourceCardinality: '1',
        targetCardinality: '*'
      },
      {
        source: '映射 Mapping',
        target: '属性 Property',
        relation: 'manyToMany',
        label: '物化为属性',
        sourceCardinality: '*',
        targetCardinality: '1'
      },
      {
        source: '数据集 Dataset',
        target: '对象类型 ObjectType',
        relation: 'oneToMany',
        label: '支撑对象类型',
        sourceCardinality: '1',
        targetCardinality: '*'
      }
    ]
  },
  {
    name: '电商系统',
    description: '面向在线零售的核心域模型：用户、商品、订单、支付。',
    keywords: ['电商', '商城', '购物', '订单', '商品', 'shop', 'ecommerce', 'order', 'product'],
    entities: [
      {
        label: '用户 User',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true, comment: '用户ID' },
          { name: 'username', type: 'VARCHAR(64)', comment: '用户名' },
          { name: 'email', type: 'VARCHAR(128)', comment: '邮箱' },
          { name: 'phone', type: 'VARCHAR(20)', comment: '手机号' },
          { name: 'password_hash', type: 'VARCHAR(255)', comment: '密码哈希' }
        ],
        methods: [
          { name: 'login', returnType: 'Token', params: 'credentials' },
          { name: 'updateProfile', returnType: 'void', params: 'profile' }
        ]
      },
      {
        label: '商品 Product',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true, comment: '商品ID' },
          { name: 'name', type: 'VARCHAR(128)', comment: '名称' },
          { name: 'price', type: 'DECIMAL(10,2)', comment: '价格' },
          { name: 'stock', type: 'INT', comment: '库存' },
          { name: 'category_id', type: 'BIGINT', fk: true, comment: '分类' }
        ]
      },
      {
        label: '分类 Category',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'parent_id', type: 'BIGINT', fk: true, comment: '上级分类' }
        ]
      },
      {
        label: '订单 Order',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true, comment: '订单ID' },
          { name: 'user_id', type: 'BIGINT', fk: true, comment: '下单用户' },
          { name: 'total_amount', type: 'DECIMAL(12,2)', comment: '总金额' },
          { name: 'status', type: 'VARCHAR(20)', comment: '状态' },
          { name: 'created_at', type: 'DATETIME', comment: '下单时间' }
        ]
      },
      {
        label: '订单明细 OrderItem',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'order_id', type: 'BIGINT', fk: true },
          { name: 'product_id', type: 'BIGINT', fk: true },
          { name: 'quantity', type: 'INT' },
          { name: 'price', type: 'DECIMAL(10,2)' }
        ]
      },
      {
        label: '支付 Payment',
        category: 'external',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'order_id', type: 'BIGINT', fk: true },
          { name: 'amount', type: 'DECIMAL(12,2)' },
          { name: 'method', type: 'VARCHAR(20)', comment: '支付方式' },
          { name: 'paid_at', type: 'DATETIME' }
        ]
      }
    ],
    edges: [
      { source: '用户 User', target: '订单 Order', relation: 'oneToMany', label: '下单' },
      { source: '订单 Order', target: '订单明细 OrderItem', relation: 'oneToMany', label: '包含' },
      { source: '商品 Product', target: '订单明细 OrderItem', relation: 'oneToMany', label: '被购买' },
      { source: '分类 Category', target: '商品 Product', relation: 'oneToMany', label: '分类' },
      { source: '订单 Order', target: '支付 Payment', relation: 'oneToOne', label: '支付' }
    ]
  },
  {
    name: '博客系统',
    description: '内容创作平台核心域：用户、文章、评论、标签。',
    keywords: ['博客', '文章', '内容', '评论', 'blog', 'article', 'cms', 'post'],
    entities: [
      {
        label: '作者 Author',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'email', type: 'VARCHAR(128)' },
          { name: 'bio', type: 'TEXT' }
        ]
      },
      {
        label: '文章 Post',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'author_id', type: 'BIGINT', fk: true },
          { name: 'title', type: 'VARCHAR(200)' },
          { name: 'content', type: 'TEXT' },
          { name: 'published_at', type: 'DATETIME' }
        ]
      },
      {
        label: '评论 Comment',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'post_id', type: 'BIGINT', fk: true },
          { name: 'author_id', type: 'BIGINT', fk: true },
          { name: 'content', type: 'TEXT' },
          { name: 'created_at', type: 'DATETIME' }
        ]
      },
      {
        label: '标签 Tag',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(32)' }
        ]
      }
    ],
    edges: [
      { source: '作者 Author', target: '文章 Post', relation: 'oneToMany', label: '撰写' },
      { source: '文章 Post', target: '评论 Comment', relation: 'oneToMany', label: '拥有' },
      { source: '作者 Author', target: '评论 Comment', relation: 'oneToMany', label: '发表' },
      { source: '文章 Post', target: '标签 Tag', relation: 'manyToMany', label: '标记' }
    ]
  },
  {
    name: '教务管理系统',
    description: '学校教务核心域：学生、教师、课程、选课、成绩。',
    keywords: ['学校', '学生', '课程', '教务', '教师', '成绩', 'school', 'student', 'course'],
    entities: [
      {
        label: '学生 Student',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'student_no', type: 'VARCHAR(20)' },
          { name: 'major', type: 'VARCHAR(64)' }
        ]
      },
      {
        label: '教师 Teacher',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'title', type: 'VARCHAR(32)' }
        ]
      },
      {
        label: '课程 Course',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(128)' },
          { name: 'credit', type: 'INT' },
          { name: 'teacher_id', type: 'BIGINT', fk: true }
        ]
      },
      {
        label: '选课 Enrollment',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'student_id', type: 'BIGINT', fk: true },
          { name: 'course_id', type: 'BIGINT', fk: true },
          { name: 'score', type: 'DECIMAL(5,2)' }
        ]
      }
    ],
    edges: [
      { source: '学生 Student', target: '选课 Enrollment', relation: 'oneToMany', label: '选课' },
      { source: '课程 Course', target: '选课 Enrollment', relation: 'oneToMany', label: '被选' },
      { source: '教师 Teacher', target: '课程 Course', relation: 'oneToMany', label: '讲授' }
    ]
  },
  {
    name: 'CRM 客户关系管理',
    description: '销售与客户管理核心域：客户、联系人、商机、合同、跟进。',
    keywords: ['crm', '客户', '销售', '商机', '线索', '合同', 'lead', 'customer', 'sales', 'opportunity'],
    entities: [
      {
        label: '客户 Customer',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true, comment: '客户ID' },
          { name: 'name', type: 'VARCHAR(128)', comment: '客户名称' },
          { name: 'industry', type: 'VARCHAR(64)', comment: '行业' },
          { name: 'level', type: 'VARCHAR(16)', comment: '客户等级' },
          { name: 'owner_id', type: 'BIGINT', fk: true, comment: '负责人' }
        ]
      },
      {
        label: '联系人 Contact',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'customer_id', type: 'BIGINT', fk: true },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'title', type: 'VARCHAR(64)', comment: '职位' },
          { name: 'phone', type: 'VARCHAR(20)' },
          { name: 'email', type: 'VARCHAR(128)' }
        ]
      },
      {
        label: '商机 Opportunity',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'customer_id', type: 'BIGINT', fk: true },
          { name: 'title', type: 'VARCHAR(128)' },
          { name: 'amount', type: 'DECIMAL(14,2)', comment: '预计金额' },
          { name: 'stage', type: 'VARCHAR(32)', comment: '阶段' },
          { name: 'expected_close', type: 'DATE', comment: '预计成交日' }
        ]
      },
      {
        label: '合同 Contract',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'opportunity_id', type: 'BIGINT', fk: true },
          { name: 'amount', type: 'DECIMAL(14,2)' },
          { name: 'signed_at', type: 'DATE' },
          { name: 'status', type: 'VARCHAR(20)' }
        ]
      },
      {
        label: '销售员 SalesRep',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'team', type: 'VARCHAR(64)' }
        ]
      }
    ],
    edges: [
      { source: '客户 Customer', target: '联系人 Contact', relation: 'oneToMany', label: '拥有' },
      { source: '客户 Customer', target: '商机 Opportunity', relation: 'oneToMany', label: '产生' },
      { source: '商机 Opportunity', target: '合同 Contract', relation: 'oneToOne', label: '转化' },
      { source: '销售员 SalesRep', target: '客户 Customer', relation: 'oneToMany', label: '负责' }
    ]
  },
  {
    name: 'HR 人力资源系统',
    description: '人力资源核心域：员工、部门、职位、考勤、薪资。',
    keywords: ['hr', '人力', '人事', '员工', '部门', '考勤', '薪资', 'employee', 'payroll', 'attendance'],
    entities: [
      {
        label: '员工 Employee',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true, comment: '员工ID' },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'department_id', type: 'BIGINT', fk: true },
          { name: 'position_id', type: 'BIGINT', fk: true },
          { name: 'hire_date', type: 'DATE', comment: '入职日期' },
          { name: 'email', type: 'VARCHAR(128)' }
        ]
      },
      {
        label: '部门 Department',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'parent_id', type: 'BIGINT', fk: true, comment: '上级部门' }
        ]
      },
      {
        label: '职位 Position',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'title', type: 'VARCHAR(64)' },
          { name: 'level', type: 'VARCHAR(16)' }
        ]
      },
      {
        label: '考勤 Attendance',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'employee_id', type: 'BIGINT', fk: true },
          { name: 'date', type: 'DATE' },
          { name: 'check_in', type: 'DATETIME' },
          { name: 'check_out', type: 'DATETIME' }
        ]
      },
      {
        label: '薪资 Payroll',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'employee_id', type: 'BIGINT', fk: true },
          { name: 'month', type: 'VARCHAR(7)', comment: '月份 YYYY-MM' },
          { name: 'gross', type: 'DECIMAL(12,2)', comment: '应发' },
          { name: 'net', type: 'DECIMAL(12,2)', comment: '实发' }
        ]
      }
    ],
    edges: [
      { source: '部门 Department', target: '员工 Employee', relation: 'oneToMany', label: '包含' },
      { source: '职位 Position', target: '员工 Employee', relation: 'oneToMany', label: '担任' },
      { source: '员工 Employee', target: '考勤 Attendance', relation: 'oneToMany', label: '打卡' },
      { source: '员工 Employee', target: '薪资 Payroll', relation: 'oneToMany', label: '结算' }
    ]
  },
  {
    name: '物流配送系统',
    description: '物流仓配核心域：货物、运单、仓库、车辆、轨迹。',
    keywords: ['物流', '配送', '仓储', '运单', '快递', '供应链', 'logistics', 'shipment', 'warehouse', 'delivery'],
    entities: [
      {
        label: '运单 Shipment',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true, comment: '运单号' },
          { name: 'sender', type: 'VARCHAR(64)', comment: '寄件人' },
          { name: 'receiver', type: 'VARCHAR(64)', comment: '收件人' },
          { name: 'origin', type: 'VARCHAR(128)', comment: '始发地' },
          { name: 'destination', type: 'VARCHAR(128)', comment: '目的地' },
          { name: 'status', type: 'VARCHAR(20)' },
          { name: 'warehouse_id', type: 'BIGINT', fk: true }
        ]
      },
      {
        label: '货物 Cargo',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'shipment_id', type: 'BIGINT', fk: true },
          { name: 'name', type: 'VARCHAR(128)' },
          { name: 'weight', type: 'DECIMAL(10,2)', comment: '重量(kg)' },
          { name: 'volume', type: 'DECIMAL(10,2)', comment: '体积(m3)' }
        ]
      },
      {
        label: '仓库 Warehouse',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'address', type: 'VARCHAR(255)' }
        ]
      },
      {
        label: '车辆 Vehicle',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'plate_no', type: 'VARCHAR(16)', comment: '车牌' },
          { name: 'capacity', type: 'DECIMAL(10,2)' }
        ]
      },
      {
        label: '轨迹 TrackingEvent',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'shipment_id', type: 'BIGINT', fk: true },
          { name: 'location', type: 'VARCHAR(128)' },
          { name: 'event', type: 'VARCHAR(64)' },
          { name: 'occurred_at', type: 'DATETIME' }
        ]
      }
    ],
    edges: [
      { source: '运单 Shipment', target: '货物 Cargo', relation: 'oneToMany', label: '包含' },
      { source: '仓库 Warehouse', target: '运单 Shipment', relation: 'oneToMany', label: '发出' },
      { source: '运单 Shipment', target: '轨迹 TrackingEvent', relation: 'oneToMany', label: '产生' },
      { source: '车辆 Vehicle', target: '运单 Shipment', relation: 'oneToMany', label: '承运' }
    ]
  },
  {
    name: '金融账户系统',
    description: '银行/支付核心域：账户、交易、卡片、贷款。',
    keywords: ['金融', '银行', '账户', '交易', '支付', '贷款', '理财', 'finance', 'bank', 'account', 'transaction', 'loan'],
    entities: [
      {
        label: '账户 Account',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true, comment: '账户ID' },
          { name: 'account_no', type: 'VARCHAR(32)', comment: '账号' },
          { name: 'customer_id', type: 'BIGINT', fk: true },
          { name: 'balance', type: 'DECIMAL(18,2)', comment: '余额' },
          { name: 'currency', type: 'VARCHAR(8)', comment: '币种' },
          { name: 'status', type: 'VARCHAR(16)' }
        ]
      },
      {
        label: '客户 Customer',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'id_card', type: 'VARCHAR(32)', comment: '证件号' }
        ]
      },
      {
        label: '交易 Transaction',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'account_id', type: 'BIGINT', fk: true },
          { name: 'type', type: 'VARCHAR(16)', comment: '存/取/转' },
          { name: 'amount', type: 'DECIMAL(18,2)' },
          { name: 'balance_after', type: 'DECIMAL(18,2)' },
          { name: 'occurred_at', type: 'DATETIME' }
        ]
      },
      {
        label: '银行卡 Card',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'account_id', type: 'BIGINT', fk: true },
          { name: 'card_no', type: 'VARCHAR(24)' },
          { name: 'expire', type: 'VARCHAR(7)' }
        ]
      },
      {
        label: '贷款 Loan',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'customer_id', type: 'BIGINT', fk: true },
          { name: 'principal', type: 'DECIMAL(18,2)', comment: '本金' },
          { name: 'rate', type: 'DECIMAL(6,4)', comment: '利率' },
          { name: 'term_months', type: 'INT' }
        ]
      }
    ],
    edges: [
      { source: '客户 Customer', target: '账户 Account', relation: 'oneToMany', label: '开立' },
      { source: '账户 Account', target: '交易 Transaction', relation: 'oneToMany', label: '发生' },
      { source: '账户 Account', target: '银行卡 Card', relation: 'oneToMany', label: '绑定' },
      { source: '客户 Customer', target: '贷款 Loan', relation: 'oneToMany', label: '申请' }
    ]
  },
  {
    name: 'IoT 物联网平台',
    description: '物联网核心域：设备、传感器、遥测数据、告警、固件。',
    keywords: ['iot', '物联网', '设备', '传感器', '遥测', '告警', 'device', 'sensor', 'telemetry', 'mqtt'],
    entities: [
      {
        label: '设备 Device',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true, comment: '设备ID' },
          { name: 'serial_no', type: 'VARCHAR(64)', comment: '序列号' },
          { name: 'model', type: 'VARCHAR(64)' },
          { name: 'status', type: 'VARCHAR(16)', comment: '在线状态' },
          { name: 'firmware_id', type: 'BIGINT', fk: true }
        ]
      },
      {
        label: '传感器 Sensor',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'device_id', type: 'BIGINT', fk: true },
          { name: 'type', type: 'VARCHAR(32)', comment: '温度/湿度等' },
          { name: 'unit', type: 'VARCHAR(16)' }
        ]
      },
      {
        label: '遥测 Telemetry',
        category: 'db',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'sensor_id', type: 'BIGINT', fk: true },
          { name: 'value', type: 'DECIMAL(14,4)' },
          { name: 'recorded_at', type: 'DATETIME' }
        ]
      },
      {
        label: '告警 Alert',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'device_id', type: 'BIGINT', fk: true },
          { name: 'level', type: 'VARCHAR(16)' },
          { name: 'message', type: 'VARCHAR(255)' },
          { name: 'triggered_at', type: 'DATETIME' }
        ]
      },
      {
        label: '固件 Firmware',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'version', type: 'VARCHAR(32)' },
          { name: 'released_at', type: 'DATE' }
        ]
      }
    ],
    edges: [
      { source: '设备 Device', target: '传感器 Sensor', relation: 'oneToMany', label: '搭载' },
      { source: '传感器 Sensor', target: '遥测 Telemetry', relation: 'oneToMany', label: '上报' },
      { source: '设备 Device', target: '告警 Alert', relation: 'oneToMany', label: '触发' },
      { source: '固件 Firmware', target: '设备 Device', relation: 'oneToMany', label: '部署' }
    ]
  },
  {
    name: '医疗诊疗系统',
    description: '医院信息系统核心域：患者、医生、挂号、病历、处方。',
    keywords: ['医疗', '医院', '患者', '病人', '挂号', '病历', '处方', '诊疗', 'health', 'hospital', 'patient', 'medical'],
    entities: [
      {
        label: '患者 Patient',
        category: 'service',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true, comment: '患者ID' },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'gender', type: 'VARCHAR(8)' },
          { name: 'birth_date', type: 'DATE' },
          { name: 'phone', type: 'VARCHAR(20)' }
        ]
      },
      {
        label: '医生 Doctor',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'name', type: 'VARCHAR(64)' },
          { name: 'department', type: 'VARCHAR(64)', comment: '科室' },
          { name: 'title', type: 'VARCHAR(32)' }
        ]
      },
      {
        label: '挂号 Registration',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'patient_id', type: 'BIGINT', fk: true },
          { name: 'doctor_id', type: 'BIGINT', fk: true },
          { name: 'visit_date', type: 'DATETIME' },
          { name: 'status', type: 'VARCHAR(16)' }
        ]
      },
      {
        label: '病历 MedicalRecord',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'registration_id', type: 'BIGINT', fk: true },
          { name: 'diagnosis', type: 'TEXT', comment: '诊断' },
          { name: 'created_at', type: 'DATETIME' }
        ]
      },
      {
        label: '处方 Prescription',
        fields: [
          { name: 'id', type: 'BIGINT', pk: true },
          { name: 'record_id', type: 'BIGINT', fk: true },
          { name: 'drug', type: 'VARCHAR(128)', comment: '药品' },
          { name: 'dosage', type: 'VARCHAR(64)', comment: '用量' }
        ]
      }
    ],
    edges: [
      { source: '患者 Patient', target: '挂号 Registration', relation: 'oneToMany', label: '挂号' },
      { source: '医生 Doctor', target: '挂号 Registration', relation: 'oneToMany', label: '接诊' },
      { source: '挂号 Registration', target: '病历 MedicalRecord', relation: 'oneToOne', label: '生成' },
      { source: '病历 MedicalRecord', target: '处方 Prescription', relation: 'oneToMany', label: '开具' }
    ]
  }
]

const GENERIC_TEMPLATE: Template = {
  name: '通用系统',
  description: '通用业务域示例模型。',
  keywords: [],
  entities: [
    {
      label: '用户 User',
      category: 'service',
      fields: [
        { name: 'id', type: 'BIGINT', pk: true },
        { name: 'name', type: 'VARCHAR(64)' },
        { name: 'email', type: 'VARCHAR(128)' },
        { name: 'created_at', type: 'DATETIME' }
      ],
      methods: [{ name: 'register', returnType: 'User', params: 'dto' }]
    },
    {
      label: '业务实体 Entity',
      category: 'service',
      fields: [
        { name: 'id', type: 'BIGINT', pk: true },
        { name: 'user_id', type: 'BIGINT', fk: true },
        { name: 'name', type: 'VARCHAR(128)' },
        { name: 'status', type: 'VARCHAR(20)' },
        { name: 'created_at', type: 'DATETIME' }
      ]
    },
    {
      label: '明细 Detail',
      fields: [
        { name: 'id', type: 'BIGINT', pk: true },
        { name: 'entity_id', type: 'BIGINT', fk: true },
        { name: 'value', type: 'VARCHAR(255)' }
      ]
    }
  ],
  edges: [
    { source: '用户 User', target: '业务实体 Entity', relation: 'oneToMany', label: '拥有' },
    { source: '业务实体 Entity', target: '明细 Detail', relation: 'oneToMany', label: '包含' }
  ]
}

function pickTemplate(prompt: string): Template {
  const text = prompt.toLowerCase()
  let best: Template | null = null
  let bestScore = 0
  for (const t of TEMPLATES) {
    const score = t.keywords.reduce(
      (acc, k) => acc + (text.includes(k.toLowerCase()) ? 1 : 0),
      0
    )
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  return best ?? GENERIC_TEMPLATE
}

/** 按模型类型裁剪模板内容（概念模型去类型、UML 保留方法等） */
function adaptToKind(template: Template, kind: ModelKind): { nodes: DiagramNode[] } {
  const cols = 3
  const nodes: DiagramNode[] = template.entities.map((ent, idx) => {
    const fields = ent.fields.map((f) => {
      if (kind === 'conceptual') {
        return {
          id: nanoid(),
          name: f.name,
          primaryKey: f.pk,
          foreignKey: f.fk,
          isTitle: f.title,
          comment: f.comment
        }
      }
      if (kind === 'logical') {
        const generic = f.type
          .replace(/VARCHAR\(\d+\)/i, 'string')
          .replace(/TEXT/i, 'string')
          .replace(/BIGINT|INT/i, 'integer')
          .replace(/DECIMAL\([\d,]+\)/i, 'decimal')
          .replace(/DATETIME/i, 'datetime')
        return {
          id: nanoid(),
          name: f.name,
          type: generic,
          primaryKey: f.pk,
          foreignKey: f.fk,
          notNull: f.pk,
          comment: f.comment
        }
      }
      if (kind === 'uml') {
        return {
          id: nanoid(),
          name: f.name,
          type: f.type.replace(/VARCHAR\(\d+\)|TEXT/i, 'String').replace(/BIGINT|INT/i, 'Long'),
          visibility: 'private' as const,
          comment: f.comment
        }
      }
      // physical / architecture 保留原始类型
      return {
        id: nanoid(),
        name: f.name,
        type: f.type,
        primaryKey: f.pk,
        foreignKey: f.fk,
        notNull: f.pk,
        comment: f.comment
      }
    })
    const node: DiagramNode = {
      id: nanoid(),
      label: ent.label,
      fields,
      category: ent.category,
      position: { x: 60 + (idx % cols) * 300, y: 60 + Math.floor(idx / cols) * 240 }
    }
    // 本体语义建模：概念模型下套用构造型（模板指定优先，否则默认 object）
    if (kind === 'conceptual') {
      node.stereotype = ent.stereotype ?? 'object'
    } else if (kind === 'uml') {
      node.stereotype = ent.stereotype === 'enum' ? 'enum' : 'class'
    }
    if (kind === 'uml' && ent.methods) {
      node.methods = ent.methods.map((m) => ({
        id: nanoid(),
        name: m.name,
        returnType: m.returnType,
        params: m.params,
        visibility: 'public' as const
      }))
    }
    return node
  })
  return { nodes }
}

function relationForKind(rel: RelationKind, kind: ModelKind): RelationKind {
  if (kind === 'physical') return 'fk'
  if (kind === 'architecture') return 'dependency'
  if (kind === 'uml' && (rel === 'oneToMany' || rel === 'manyToMany' || rel === 'oneToOne')) {
    return 'association'
  }
  return rel
}

export function mockGenerateModel(prompt: string, kind: ModelKind): ModelDoc {
  const template = pickTemplate(prompt)
  const { nodes } = adaptToKind(template, kind)
  const labelToId = new Map(nodes.map((n) => [n.label, n.id]))
  const edges = template.edges
    .map((e) => {
      const source = labelToId.get(e.source)
      const target = labelToId.get(e.target)
      if (!source || !target) return null
      return {
        id: nanoid(),
        source,
        target,
        relation: relationForKind(e.relation, kind),
        label: e.label,
        sourceCardinality: kind === 'conceptual' ? e.sourceCardinality : undefined,
        targetCardinality: kind === 'conceptual' ? e.targetCardinality : undefined
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  return {
    id: nanoid(),
    name: `${template.name}（${prompt.slice(0, 16) || '示例'}）`,
    kind,
    description: template.description,
    nodes,
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

/** 模拟局部微调：根据指令简单地增删字段/节点，演示微调链路。 */
export function mockRefineModel(
  doc: ModelDoc,
  instruction: string,
  scopeIds?: string[]
): ModelDoc {
  const text = instruction.toLowerCase()
  const next: ModelDoc = JSON.parse(JSON.stringify(doc))
  const targets =
    scopeIds && scopeIds.length
      ? next.nodes.filter((n) => scopeIds.includes(n.id))
      : next.nodes

  const wantAudit = /审计|时间|created|updated|时间戳|timestamp/.test(text)
  const wantSoftDelete = /软删除|逻辑删除|soft delete|deleted/.test(text)

  if (wantSoftDelete) {
    targets.forEach((n) => {
      if (!n.fields.some((f) => f.name === 'is_deleted')) {
        n.fields.push({ id: nanoid(), name: 'is_deleted', type: 'BOOLEAN', notNull: true, comment: '软删除标记' })
      }
    })
  }
  if (wantAudit || (!wantSoftDelete && !/添加|新增|增加|add/.test(text))) {
    targets.forEach((n) => {
      if (!n.fields.some((f) => f.name === 'created_at')) {
        n.fields.push({ id: nanoid(), name: 'created_at', type: 'DATETIME', comment: '创建时间' })
      }
      if (!n.fields.some((f) => f.name === 'updated_at')) {
        n.fields.push({ id: nanoid(), name: 'updated_at', type: 'DATETIME', comment: '更新时间' })
      }
    })
  }

  // 若指令明确要求新增实体
  const addMatch = instruction.match(/(?:添加|新增|增加|add)\s*[「"']?([\u4e00-\u9fa5A-Za-z]+)[」"']?\s*(?:实体|表|类|节点|entity|table)?/i)
  if (addMatch && addMatch[1] && !/字段|属性|时间|审计|field|column/.test(text)) {
    const label = addMatch[1]
    if (!next.nodes.some((n) => n.label.includes(label))) {
      next.nodes.push({
        id: nanoid(),
        label,
        fields: [
          { id: nanoid(), name: 'id', type: 'BIGINT', primaryKey: true, notNull: true },
          { id: nanoid(), name: 'name', type: 'VARCHAR(128)' }
        ],
        position: { x: 80, y: 80 + next.nodes.length * 60 }
      })
    }
  }

  next.updatedAt = new Date().toISOString()
  return next
}
