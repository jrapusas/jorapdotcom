# {{ .Title }}
{{ with .Date }}
date: {{ .Format "2006-01-02" }}
{{- end }}
{{ with .Params.description }}
> {{ . }}
{{- end }}

{{ if .RawContent }}{{ .RawContent }}{{ else }}{{ partial "llms-page-body-fallback.html" . }}{{ end }}
