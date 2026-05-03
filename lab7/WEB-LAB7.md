# Lab 7 - Back-end

Create a CRUD API for your entities from [Lab6 task](https://gist.github.com/strdr4605/15e0feff916d97e36415be547c31fd62).

You can use following technologies/tools/protocols: [REST API](https://restfulapi.net/), [GraphQL API](https://graphql.org/), [GRPC API](https://grpc.io/).

# Client requirements

- The API for CRUD operations should be accessible only with a [JWT](https://jwt.io/) that allows the operation
  - JWT should store the permissions or roles
    - Example: `PERMISSIONS: ["READ", "WRITE", ...]` or `ROLE: "ADMIN" | "WRITER" | "VISITOR"`
  - JWT should have an expiration (For demos: set expiration in 1 minute)
- Connect the Front-end app with Back-end API

# Dev requirements

- The API should have documentation using [Swagger UI](https://swagger.io/tools/swagger-ui/), or similar tools for selected technology.
- Use appropriate status codes for responses
- API should be ready to handle large amout of data and [support pagination](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design#filter-and-paginate-data)
  - example: getting only N entities, and skipping M entities
- Have a `/token` endpoint that will return the JWT for other endpoints to access
  - role/permissions, can be passed as a JSON to a POST request, or query to a GET request

# Other requirements

- Integrate fully or partially the API with Client-side app from [Lab6 task](https://gist.github.com/strdr4605/15e0feff916d97e36415be547c31fd62).

- See [submission requirements](https://else.fcim.utm.md/mod/assign/view.php?id=48727)