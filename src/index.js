import Promise from 'bluebird';

/**
 * The default pagination options, these can be overridden
 * by the user by passing an options object as the first argument
 * to the Model#pagination call. The 'sort' column here can
 * refer to any column in the Model's table or another table using
 * the standard 'table.column' notation.
 */
const defaultOptions = {
    page: 1,
    limit: 10,
    sort: 'id',
    order: 'ASC',
};

/**
 * Applies the query object or function passed through by the user
 * This is basically copied from:
 *
 * https://github.com/tgriesser/bookshelf/blob/master/src/helpers.js#L41-L74
 */
function fullQuery (qb, method) {
    if (typeof method === 'function') {
        // `method` is a query builder callback. Call it on the query builder
        // object.
        Reflect.apply(method, qb, [qb]);
    } else if (typeof method === 'object') {
        // `method` is an object. Use keys as methods and values as arguments to
        // the query builder.
        for (const key in method) {
            if (method.hasOwnProperty(key)) {
                const target = Array.isArray(method[key]) ? method[key] : [method[key]];

                Reflect.apply(qb[key], qb, target);
            }
        }
    }

    return null;
}

/**
 * Applies the pagination limit, offset, and ordering of results
 */
function paginationQuery ({ qb, method, limit, offset, orderBy }) {
    fullQuery(qb, method);
    qb.limit(limit);
    qb.offset(offset);
    qb.orderBy(...orderBy);
    return null;
}

/**
 * Exports a plugin to pass into the bookshelf instance, i.e.:
 *
 *      import config from './knexfile';
 *      import knex from 'knex';
 *      import bookshelf from 'bookshelf';
 *      import pagination from 'bookshelf-pagination-plugin';
 *
 *      const ORM = bookshelf(knex(config));
 *
 *      ORM.plugin(pagination);
 *
 *      export default ORM;
 *
 * The plugin attaches one static and one instance method to the bookshelf
 * Model object, both called 'paginate'.
 *
 * Model#paginate takes three parameters:
 *
 *      - an options object as described above
 *      - a query builder object or function, the same as what would be passed
 *        to Model##query
 *      - the fetch options object, same as what gets passed to Model#fetchAll
 *
 * The method returns a promise that resolves with an object containing the
 * found rows and pagination metadata:
 *
 *      {
 *          total: (integer),
 *          page: (integer),
 *          offset: (integer),
 *          rows: (Array[Model])
 *      }
 *
 * This allows for simple creation of paginated complex queries.
 * See the cars-api-example.js gist for an example.
 */
export default function paginate (bookshelf) {
    bookshelf.Model = bookshelf.Model.extend({

        paginate (pagingOptions = defaultOptions, queryOptions, fetchOptions) {
            const options = Object.assign({}, defaultOptions, pagingOptions);
            const { limit, page, sort, order } = options;
            const offset = limit * (page - 1);

            const tableName = this.constructor.prototype.tableName;
            const idAttribute = this.constructor.prototype.idAttribute ?
                this.constructor.prototype.idAttribute : 'id';

            let orderBy;

            if (sort.indexOf('.') > -1) {
                orderBy = [tableName + sort, order];
            } else {
                orderBy = [sort, order];
            }


            const fetchPage = () => this.constructor.forge()

                .query(qb => paginationQuery({
                    qb, limit, offset, orderBy,
                    method: queryOptions,
                }))

                .fetchAll(fetchOptions);

            const count = () => this.constructor.forge()

                .query(qb => fullQuery(qb, queryOptions))

                .count(`${tableName}.${idAttribute}`)

                .then(total => {
                    return {
                        total,
                        page,
                        limit,
                        offset,
                    };
                });

            return Promise.join(fetchPage(), count())

                .then(([rows, meta]) => Object.assign({ rows }, meta, {rowCount: rows.length }));
        },

    }, {
        paginate (options, queryOptions, fetchOptions) {
            return this.forge().paginate(options, queryOptions, fetchOptions);
        },
    });
}
