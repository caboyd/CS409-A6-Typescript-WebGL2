#version 300 es
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;
//uniform mat4 u_ModelView;
//uniform mat4 u_Persp;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

out vec3 ourColor;

void main()
{

gl_Position =   vec4(aPos,1.0f);
ourColor = aColor;
// gl_Position = u_Persp * u_ModelView * vec4(Position, 1.0);
//    gl_Position = projection * view * model * vec4(Position, 1.0f);
}   