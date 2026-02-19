"""
MongoDB utility functions
"""

from typing import Dict, List, Any, Optional


def clean_mongo_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Remove MongoDB _id field from document
    
    Args:
        doc: MongoDB document dictionary
    
    Returns:
        Document with _id removed, or None if input was None
    """
    if doc and isinstance(doc, dict):
        doc_copy = dict(doc)
        doc_copy.pop('_id', None)
        return doc_copy
    return doc


def clean_mongo_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove MongoDB _id field from list of documents
    
    Args:
        docs: List of MongoDB document dictionaries
    
    Returns:
        List of documents with _id removed
    """
    return [clean_mongo_doc(doc) for doc in docs]
