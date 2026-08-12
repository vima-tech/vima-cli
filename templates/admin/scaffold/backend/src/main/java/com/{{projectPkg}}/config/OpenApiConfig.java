package com.{{projectPkg}}.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * springdoc OpenAPI 配置。文档入口：/swagger-ui/index.html（JSON：/v3/api-docs）。
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        String bearerScheme = "bearerAuth";
        return new OpenAPI()
                .info(new Info()
                        .title("{{projectName}} API")
                        .version("0.0.1")
                        .description("{{projectName}} 后台管理接口文档。"
                                + "默认账号：admin / admin123（管理员，全部权限），test / test123（测试用户，仅列表权限）。"
                                + "先调用 POST /api/auth/login 获取 token，再点右上角 Authorize 填入。"))
                .components(new Components()
                        .addSecuritySchemes(bearerScheme, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .description("登录接口返回的 token")))
                .addSecurityItem(new SecurityRequirement().addList(bearerScheme));
    }
}
