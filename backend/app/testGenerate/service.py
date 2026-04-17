from __future__ import annotations

import os
from typing import Any, Dict

from .repo import TestGenerateRepository
from .chunker import ServletPptxMvpChunker, ChunkConfig, make_report


class TestGenerateService:
    def __init__(self, repo: TestGenerateRepository, upload_dir: str = "uploads"):
        self.repo = repo
        self.upload_dir = upload_dir

    async def upload_and_chunk(self, *, filename: str, file_bytes: bytes) -> Dict[str, Any]:
        """
        MVP: 上传 PPTX -> 使用 Unstructured + 定制规则分块 -> 写入 sources/parses/chunks -> 返回 IDs
        """
        os.makedirs(self.upload_dir, exist_ok=True)
        filepath = os.path.join(self.upload_dir, filename)

        # 1) 保存文件
        with open(filepath, "wb") as f:
            f.write(file_bytes)

        # 2) 建 source + parse
        source = await self.repo.create_source(
            filename=filename,
            filepath=filepath,
            filetype="pptx",
        )

        chunking_strategy: Dict[str, Any] = {
            "type": "pptx_servlet_mvp_unstructured",
            "max_characters": 1200,
            "new_after_n_chars": 950,
            "combine_text_under_n_chars": 120,
            "overlap": 60,
            "infer_table_structure": True,
            "strategy": "hi_res",
        }

        parse = await self.repo.create_parse(
            source_id=source.id,
            chunking_strategy=chunking_strategy,
        )

        # 3) 分块 + 入库 + 更新状态
        try:
            chunker = ServletPptxMvpChunker(
                ChunkConfig(
                    max_characters=chunking_strategy["max_characters"],
                    new_after_n_chars=chunking_strategy["new_after_n_chars"],
                    combine_text_under_n_chars=chunking_strategy["combine_text_under_n_chars"],
                    overlap=chunking_strategy["overlap"],
                )
            )

            chunks = chunker.chunk(filepath)  # [{chunk_index, content, meta}, ...]
            report = make_report(chunks)

            n = await self.repo.insert_chunks(parse_id=parse.id, chunks=chunks)

            await self.repo.update_parse_done(parse_id=parse.id)
            await self.repo.update_source_done(source_id=source.id, chunks_count=n)

            script = await self.repo.create_script_placeholder(
                source_id=source.id,
                parse_id=parse.id,
            )

            # MVP：report 建议先返回给前端/日志，用于调参；不想改前端类型可先删掉该字段
            return {
                "success": True,
                "source_id": str(source.id),
                "parse_id": str(parse.id),
                "script_id": str(script.id),
                "chunks_count": n,
                "quality_report": report,
            }

        except Exception as e:
            await self.repo.update_parse_failed(parse_id=parse.id, error=str(e))
            await self.repo.update_source_failed(source_id=source.id, error=str(e))
            raise
