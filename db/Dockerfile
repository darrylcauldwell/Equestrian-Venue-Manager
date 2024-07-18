FROM mongo:latest
COPY ./users.json /users.json
COPY ./import_data.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/import_data.sh
