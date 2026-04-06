FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY conf/nginx.conf /etc/nginx/conf.d/
# COPY conf/index.html /var/www/html/
COPY conf/502.html /var/www/html/

EXPOSE 80 81

CMD ["nginx", "-g", "daemon off;"]
